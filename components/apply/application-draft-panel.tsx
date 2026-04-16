"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileStack, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";

type PublicApplication = {
  id: string;
  referenceNumber: string | null;
  applicationStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  draftExpiresAt: string | null;
  nationalityCode: string;
  serviceId: string;
  isGuest: boolean;
};

type DocRow = {
  id: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  extractionStatus: string;
  createdAt: string;
};

export function ApplicationDraftPanel({ applicationId }: { applicationId: string }) {
  const [app, setApp] = useState<PublicApplication | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [patching, setPatching] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [registering, setRegistering] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchApiEnvelope<{ application: PublicApplication }>(
      `/api/applications/${applicationId}`,
    );
    setLoading(false);
    if (!res.ok) {
      setApp(null);
      setError(res.error.message);
      return;
    }
    setApp(res.data.application);
  }, [applicationId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function onPatchEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!guestEmail.trim()) return;
    setPatching(true);
    setActionMsg(null);
    const res = await fetchApiEnvelope<{ application: PublicApplication }>(
      `/api/applications/${applicationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestEmail: guestEmail.trim() }),
      },
    );
    setPatching(false);
    if (!res.ok) {
      setActionMsg(res.error.message);
      return;
    }
    setApp(res.data.application);
    setActionMsg("Email saved.");
  }

  async function onRegisterDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setActionMsg("Choose a file first.");
      return;
    }
    setRegistering(true);
    setActionMsg(null);
    const storageKey = `ui-local/${crypto.randomUUID()}/${file.name.replace(/[^\w.-]+/g, "_")}`;
    const res = await fetchApiEnvelope<{ document: DocRow }>(`/api/applications/${applicationId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storageKey,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      }),
    });
    setRegistering(false);
    if (!res.ok) {
      setActionMsg(res.error.message);
      return;
    }
    setDocs((d) => [res.data.document, ...d]);
    setFile(null);
    setActionMsg("Document metadata registered (storage is not wired in this demo path).");
  }

  async function onExtract() {
    setExtracting(true);
    setActionMsg(null);
    const res = await fetchApiEnvelope<{ accepted: boolean; documentIds: string[] }>(
      `/api/applications/${applicationId}/extract`,
      { method: "POST" },
    );
    setExtracting(false);
    if (!res.ok) {
      setActionMsg(res.error.message);
      return;
    }
    setActionMsg(
      res.data.documentIds.length
        ? `Queued extraction for ${res.data.documentIds.length} document(s).`
        : "No pending documents to queue.",
    );
    setDocs((rows) =>
      rows.map((r) =>
        res.data.documentIds.includes(r.id) ? { ...r, extractionStatus: "queued" } : r,
      ),
    );
  }

  if (loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading application…
      </p>
    );
  }

  if (error || !app) {
    return (
      <div className="border-border bg-card space-y-4 border p-5">
        <p className="text-destructive text-sm leading-relaxed">{error ?? "Not found."}</p>
        <p className="text-muted-foreground text-sm">
          Guests need the same browser session (resume cookie). Signed-in users must own this draft.
        </p>
        <Button type="button" variant="outline" className="rounded-none" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-4" aria-hidden />
          Retry
        </Button>
        <Link href="/apply/start" className="text-link ml-4 text-sm font-medium">
          Start over
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="border-border bg-card border border-l-4 border-l-primary p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Application</p>
            <p className="font-heading mt-1 text-lg font-semibold tracking-tight">{app.id}</p>
            <dl className="text-muted-foreground mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-foreground font-medium">Status</dt>
                <dd className="font-mono text-xs">{app.applicationStatus}</dd>
              </div>
              <div>
                <dt className="text-foreground font-medium">Payment</dt>
                <dd className="font-mono text-xs">{app.paymentStatus}</dd>
              </div>
              <div>
                <dt className="text-foreground font-medium">Nationality</dt>
                <dd className="font-mono text-xs">{app.nationalityCode}</dd>
              </div>
              <div>
                <dt className="text-foreground font-medium">Service</dt>
                <dd className="font-mono text-xs break-all">{app.serviceId}</dd>
              </div>
              <div>
                <dt className="text-foreground font-medium">Guest</dt>
                <dd className="font-mono text-xs">{app.isGuest ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt className="text-foreground font-medium">Draft expires</dt>
                <dd className="font-mono text-xs">
                  {app.draftExpiresAt ? new Date(app.draftExpiresAt).toLocaleString() : "—"}
                </dd>
              </div>
            </dl>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none"
            onClick={() => void load()}
          >
            <RefreshCw className="size-4" aria-hidden />
            Refresh
          </Button>
        </div>
      </section>

      {actionMsg ? (
        <p className="text-accent-foreground border-accent/30 bg-accent/15 text-sm border-l-4 border-l-accent px-3 py-2">
          {actionMsg}
        </p>
      ) : null}

      <section className="border-border bg-card space-y-4 border p-5 sm:p-6">
        <h2 className="font-heading text-base font-semibold tracking-tight">Contact on draft</h2>
        <form onSubmit={onPatchEmail} className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="ge">Guest email</Label>
            <Input
              id="ge"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="Patch guest email"
              className="rounded-none"
            />
          </div>
          <Button type="submit" disabled={patching} className="rounded-none sm:shrink-0">
            {patching ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </form>
      </section>

      <section className="border-border bg-card space-y-4 border p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading flex items-center gap-2 text-base font-semibold tracking-tight">
            <FileStack className="text-primary size-5" aria-hidden />
            Documents
          </h2>
          <Button
            type="button"
            variant="secondary"
            className="rounded-none"
            disabled={extracting}
            onClick={() => void onExtract()}
          >
            {extracting ? <Loader2 className="size-4 animate-spin" /> : "Queue extraction (pending)"}
          </Button>
        </div>
        <form onSubmit={onRegisterDocument} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="doc">File (metadata only)</Label>
            <input
              id="doc"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-muted-foreground block w-full text-sm file:mr-3 file:border file:border-border file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
            />
          </div>
          <Button type="submit" disabled={registering || !file} className="rounded-none">
            {registering ? <Loader2 className="size-4 animate-spin" /> : "Register with server"}
          </Button>
        </form>
        {docs.length ? (
          <ul className="divide-border divide-y border border-border">
            {docs.map((d) => (
              <li key={d.id} className="text-muted-foreground flex flex-col gap-1 px-3 py-2 text-xs sm:flex-row sm:justify-between">
                <span className="text-foreground font-mono break-all">{d.storageKey}</span>
                <span>
                  {d.extractionStatus} · {(d.sizeBytes / 1024).toFixed(1)} KB
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No documents registered in this session yet.</p>
        )}
      </section>

      <p className="text-muted-foreground text-center text-xs">
        <Link href="/apply/start" className="text-link hover:underline">
          Start another draft
        </Link>
        {" · "}
        <Link href="/portal" className="hover:text-foreground">
          Portal
        </Link>
      </p>
    </div>
  );
}
