"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AdminDocRow = {
  id: string;
  documentType: string | null;
  status: string | null;
  createdAt: string;
};

const TERMINAL = new Set(["completed", "rejection_by_uae_authorities", "cancelled"]);

export function AdminApplicationOpsPanel({
  applicationId,
  paymentStatus,
  applicationStatus,
  adminOpsStep,
  documents,
}: {
  applicationId: string;
  paymentStatus: string;
  applicationStatus: string;
  adminOpsStep: string | null;
  documents: AdminDocRow[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(adminOpsStep ?? "");
  const [nextStatus, setNextStatus] = useState<string>("");
  const [outcomeDocId, setOutcomeDocId] = useState("");
  const [uploadType, setUploadType] = useState("admin_step_attachment");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (paymentStatus !== "paid") {
    return (
      <p className="text-muted-foreground text-sm">
        Admin workflow uploads and status controls unlock after payment is received.
      </p>
    );
  }

  if (TERMINAL.has(applicationStatus)) {
    return (
      <p className="text-muted-foreground text-sm">
        This application is in a terminal status. Ops controls are not available.
      </p>
    );
  }

  async function saveStep() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/ops`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminOpsStep: step }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error?.message ?? "Update failed.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(ev: React.FormEvent) {
    ev.preventDefault();
    const input = (ev.target as HTMLFormElement).elements.namedItem("file") as HTMLInputElement;
    const f = input?.files?.[0];
    if (!f) {
      setMsg("Choose a file to upload.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("documentType", uploadType);
      fd.set("file", f);
      const res = await fetch(`/api/admin/applications/${applicationId}/documents/upload`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error?.message ?? "Upload failed.");
        return;
      }
      const id = data?.data?.document?.id as string | undefined;
      if (id) {
        if (uploadType === "outcome_approval" || uploadType === "outcome_authority_rejection") {
          setOutcomeDocId(id);
        }
        setMsg(`Uploaded. Document id: ${id}`);
      }
      input.value = "";
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function applyStatus() {
    if (!nextStatus) {
      setMsg("Choose a target status.");
      return;
    }
    const needsOutcome =
      nextStatus === "completed" || nextStatus === "rejection_by_uae_authorities";
    if (needsOutcome && !outcomeDocId.trim()) {
      setMsg("Upload the outcome document first, or paste the document id from the list below.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { applicationStatus: nextStatus };
      if (needsOutcome) body.outcomeDocumentId = outcomeDocId.trim();
      const res = await fetch(`/api/admin/applications/${applicationId}/ops`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error?.message ?? "Status update failed.");
        return;
      }
      const te = data?.data?.transactionalEmail as string | null | undefined;
      if (te === "skipped_mailgun_not_configured") {
        setMsg(
          "Status saved. Email was not sent: add MAILGUN_API_KEY and MAILGUN_DOMAIN to server env, then restart dev server.",
        );
      } else if (te === "skipped_no_recipient") {
        setMsg("Status saved. Email was not sent: application has no guest email and no linked user email.");
      } else if (te === "queued") {
        setMsg("Status saved. Outcome email queued (check Mailgun logs / inbox).");
      } else {
        setMsg(null);
      }
      setNextStatus("");
      setOutcomeDocId("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 border-t border-border pt-4">
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Ops step label</h3>
        <p className="text-muted-foreground text-xs">
          Optional internal label for where the case sits (e.g. submitted to authority). Cannot be combined with a
          terminal status change in the same request.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            value={step}
            onChange={(e) => setStep(e.target.value)}
            placeholder="e.g. awaiting_embassy"
            className="max-w-md rounded-none font-mono text-sm"
          />
          <Button type="button" size="sm" className="rounded-none" disabled={loading} onClick={() => void saveStep()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Save step"}
          </Button>
        </div>
      </div>

      <form className="space-y-2" onSubmit={(e) => void uploadFile(e)}>
        <h3 className="text-sm font-semibold">Upload document</h3>
        <p className="text-muted-foreground text-xs">
          Step attachments are optional. Outcome uploads are required before setting approval or UAE authority rejection.
          Max 8 MB; JPEG, PNG, or PDF.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value)}
            className="border-border bg-background h-9 rounded-none border px-2 text-sm"
          >
            <option value="admin_step_attachment">Step attachment (optional)</option>
            <option value="outcome_approval">Outcome — approval / visa pack</option>
            <option value="outcome_authority_rejection">Outcome — UAE authority rejection proof</option>
          </select>
          <input name="file" type="file" accept="image/jpeg,image/png,application/pdf" className="max-w-xs text-sm" />
          <Button type="submit" size="sm" variant="secondary" className="rounded-none" disabled={loading}>
            Upload
          </Button>
        </div>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Set application status</h3>
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            className="border-border bg-background h-9 rounded-none border px-2 text-sm"
          >
            <option value="">Choose…</option>
            <option value="awaiting_authority">awaiting_authority</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed (requires outcome approval doc)</option>
            <option value="rejection_by_uae_authorities">
              rejection_by_uae_authorities (requires rejection proof doc)
            </option>
            <option value="cancelled">cancelled (no attachment)</option>
          </select>
          <Input
            value={outcomeDocId}
            onChange={(e) => setOutcomeDocId(e.target.value)}
            placeholder="outcome document id"
            className="max-w-md rounded-none font-mono text-xs"
          />
          <Button type="button" size="sm" className="rounded-none" disabled={loading} onClick={() => void applyStatus()}>
            Apply status
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Recent documents</h3>
        <ul className="mt-2 max-h-40 overflow-y-auto font-mono text-xs">
          {documents.length === 0 ? (
            <li className="text-muted-foreground">No documents yet.</li>
          ) : (
            documents.map((d) => (
              <li key={d.id} className="border-border border-b py-1">
                <span className="text-muted-foreground">{d.documentType ?? "?"}</span> · {d.status ?? "?"} ·{" "}
                {d.id.slice(0, 8)}…
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
