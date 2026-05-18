"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiHref } from "@/lib/app-href";
import { UPLOAD_MAX_BYTES } from "@/lib/applications/document-upload";
import { AdminApplicationCustomerExport } from "@/components/admin/admin-application-customer-export";
import { cn } from "@/lib/utils";

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
  documents,
}: {
  applicationId: string;
  paymentStatus: string;
  applicationStatus: string;
  documents: AdminDocRow[];
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState<string>("");
  const [outcomeDocId, setOutcomeDocId] = useState("");
  const [uploadType, setUploadType] = useState("outcome_approval");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const opsLocked =
    paymentStatus !== "paid" || TERMINAL.has(applicationStatus);
  const opsLockedMessage =
    paymentStatus !== "paid"
      ? "Outcome uploads and status controls unlock after payment is received."
      : "This application is in a terminal status. Outcome controls are not available.";

  function clearSelectedFile() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function pickAnotherFile() {
    clearSelectedFile();
    fileInputRef.current?.click();
  }

  function handleFileChosen(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0] ?? null;
    ev.target.value = "";
    if (!f) return;
    if (f.size > UPLOAD_MAX_BYTES) {
      setMsg("File exceeds 8 MB limit.");
      clearSelectedFile();
      return;
    }
    setMsg(null);
    setSelectedFile(f);
  }

  async function uploadSelectedFile() {
    if (!selectedFile) {
      setMsg("Choose a file to upload.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("documentType", uploadType);
      fd.set("file", selectedFile);
      const res = await fetch(apiHref(`/admin/applications/${applicationId}/documents/upload`), {
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
        setOutcomeDocId(id);
        setMsg(`Outcome document uploaded. Id: ${id}`);
      }
      clearSelectedFile();
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
      const res = await fetch(apiHref(`/admin/applications/${applicationId}/ops`), {
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
      <AdminApplicationCustomerExport applicationId={applicationId} />
      {opsLocked ? (
        <p className="text-muted-foreground text-sm">{opsLockedMessage}</p>
      ) : (
        <>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Upload outcome document</h3>
        <p className="text-muted-foreground text-xs">
          Upload the approval pack or UAE authority rejection proof before marking the application completed or
          rejected. Max 8 MB; JPEG, PNG, or PDF.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value)}
            className="border-border bg-background h-9 w-full shrink-0 rounded-none border px-2 text-sm sm:w-auto"
            aria-label="Outcome document type"
          >
            <option value="outcome_approval">Approval / visa pack</option>
            <option value="outcome_authority_rejection">UAE authority rejection proof</option>
          </select>

          <div className="min-w-0 flex-1 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileChosen}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />

            {!selectedFile ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 rounded-none"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose file
              </Button>
            ) : (
              <OutcomeFilePreview
                file={selectedFile}
                previewUrl={previewUrl}
                loading={loading}
                onChangeFile={pickAnotherFile}
                onPreview={() => {
                  if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer");
                }}
                onUpload={() => void uploadSelectedFile()}
              />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Set application status</h3>
        <p className="text-muted-foreground text-xs">
          Completed and UAE rejection require an outcome document uploaded above.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            className="border-border bg-background h-9 rounded-none border px-2 text-sm"
          >
            <option value="">Choose…</option>
            <option value="awaiting_authority">awaiting_authority</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed (requires approval pack)</option>
            <option value="rejection_by_uae_authorities">
              rejection_by_uae_authorities (requires rejection proof)
            </option>
            <option value="cancelled">cancelled (no document)</option>
          </select>
          <Input
            value={outcomeDocId}
            onChange={(e) => setOutcomeDocId(e.target.value)}
            placeholder="outcome document id"
            className="max-w-md rounded-none font-mono text-xs"
          />
          <Button type="button" size="sm" className="rounded-none" disabled={loading} onClick={() => void applyStatus()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Apply status"}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Outcome documents</h3>
        <ul className="mt-2 max-h-40 overflow-y-auto font-mono text-xs">
          {documents.length === 0 ? (
            <li className="text-muted-foreground">No outcome documents yet.</li>
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
        </>
      )}
    </div>
  );
}

function OutcomeFilePreview({
  file,
  previewUrl,
  loading,
  onChangeFile,
  onPreview,
  onUpload,
}: {
  file: File;
  previewUrl: string | null;
  loading: boolean;
  onChangeFile: () => void;
  onPreview: () => void;
  onUpload: () => void;
}) {
  const isImage = file.type.startsWith("image/");
  const sizeKb = (file.size / 1024).toFixed(1);

  return (
    <div className="border-border bg-muted/20 max-w-md space-y-3 border p-3">
      <div className="flex gap-3">
        {isImage && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob preview of admin-selected file
          <img
            src={previewUrl}
            alt=""
            className="border-border size-14 shrink-0 border object-cover"
          />
        ) : (
          <div
            className="border-border bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center border"
            aria-hidden
          >
            <FileText className="size-6" />
          </div>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-muted-foreground text-xs">
            {sizeKb} KB · {isImage ? "Image" : "PDF"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-none"
          disabled={!previewUrl}
          onClick={onPreview}
        >
          Preview
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-none"
          disabled={loading}
          onClick={onChangeFile}
        >
          Change file
        </Button>
        <Button
          type="button"
          size="sm"
          className={cn("rounded-none", loading && "pointer-events-none")}
          disabled={loading}
          onClick={onUpload}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Upload"}
        </Button>
      </div>
    </div>
  );
}
