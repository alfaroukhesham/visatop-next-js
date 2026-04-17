"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileStack,
  Loader2,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";

type ApplicantProfile = {
  fullName: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  profession: string | null;
  address: string | null;
  phone: string | null;
};

type PassportExtractionSummary = {
  status: string;
  updatedAt: string | null;
  documentId: string | null;
  sha256: string | null;
};

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
  guestEmail: string | null;
  checkoutState: string | null;
  applicant: ApplicantProfile;
  passportExtraction: PassportExtractionSummary;
};

type PublicDocument = {
  id: string;
  documentType: string | null;
  status: string | null;
  contentType: string | null;
  byteLength: number | null;
  originalFilename: string | null;
  sha256: string | null;
  createdAt: string;
};

type ExtractResponse = {
  extraction: {
    status: "succeeded" | "needs_manual" | "failed" | string;
    attemptsUsed: number;
    documentId: string | null;
    prefill: Partial<ApplicantProfile> & { dateOfBirth?: string | null; passportExpiryDate?: string | null };
    ocrMissingFields: string[];
    submissionMissingFields: string[];
  };
  validation: {
    readiness: "ready" | "blocked_validation" | "blocked_missing_docs" | string;
    passportValid: boolean;
    dobValid: boolean;
    requiredFieldsComplete: boolean;
    missingRequiredFields: string[];
  } | null;
};

type DocType = "passport_copy" | "personal_photo" | "supporting";

const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

const MIME_BY_TYPE: Record<DocType, string> = {
  passport_copy: "image/jpeg,image/png,application/pdf",
  personal_photo: "image/jpeg,image/png",
  supporting: "image/jpeg,image/png,application/pdf",
};

function latestByType(docs: PublicDocument[], type: DocType) {
  return docs.find((d) => d.documentType === type && d.status !== "deleted") ?? null;
}

export function ApplicationDraftPanel({ applicationId }: { applicationId: string }) {
  const [app, setApp] = useState<PublicApplication | null>(null);
  const [docs, setDocs] = useState<PublicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState<DocType | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [appRes, docsRes] = await Promise.all([
      fetchApiEnvelope<{ application: PublicApplication }>(`/api/applications/${applicationId}`),
      fetchApiEnvelope<{ documents: PublicDocument[] }>(`/api/applications/${applicationId}/documents`),
    ]);
    setLoading(false);
    if (!appRes.ok) {
      setApp(null);
      setError(appRes.error.message);
      return;
    }
    setApp(appRes.data.application);
    if (docsRes.ok) setDocs(docsRes.data.documents);
  }, [applicationId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const passport = useMemo(() => latestByType(docs, "passport_copy"), [docs]);
  const photo = useMemo(() => latestByType(docs, "personal_photo"), [docs]);

  async function onUpload(type: DocType, file: File) {
    if (file.size > UPLOAD_MAX_BYTES) {
      setActionMsg("File exceeds 8MB limit.");
      return;
    }
    setActionMsg(null);
    setUploading(type);
    const form = new FormData();
    form.set("documentType", type);
    form.set("file", file);
    const res = await fetch(`/api/applications/${applicationId}/documents/upload`, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    setUploading(null);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      const msg =
        json?.error?.message ??
        (res.status === 413
          ? "File exceeds 8MB limit."
          : `Upload failed (HTTP ${res.status})`);
      setActionMsg(msg);
      return;
    }
    setActionMsg(`${type.replace("_", " ")} uploaded.`);
    // Re-fetch doc list + application (extraction summary may have reset).
    await load();
  }

  async function onExtract() {
    if (!passport) {
      setActionMsg("Upload a passport page first.");
      return;
    }
    setExtracting(true);
    setActionMsg(null);
    const res = await fetchApiEnvelope<ExtractResponse>(`/api/applications/${applicationId}/extract`, {
      method: "POST",
    });
    setExtracting(false);
    if (!res.ok) {
      setActionMsg(res.error.message);
      return;
    }
    setExtractResult(res.data);
    setActionMsg(`Extraction ${res.data.extraction.status}.`);
    // Application profile likely changed (prefill merged by server).
    await load();
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

  const readiness = extractResult?.validation?.readiness ?? null;
  const gotBoth = Boolean(passport && photo);
  const canExtract = Boolean(passport) && !extracting;

  return (
    <div className="space-y-8">
      <section className="border-border bg-card border border-l-4 border-l-primary p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Application</p>
            <p className="font-heading mt-1 text-lg font-semibold tracking-tight">{app.id}</p>
            <dl className="text-muted-foreground mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <DtDd label="Status" value={app.applicationStatus} />
              <DtDd label="Payment" value={app.paymentStatus} />
              <DtDd label="Nationality" value={app.nationalityCode} />
              <DtDd label="Service" value={app.serviceId} mono />
              <DtDd label="Guest" value={app.isGuest ? "yes" : "no"} />
              <DtDd
                label="Draft expires"
                value={app.draftExpiresAt ? new Date(app.draftExpiresAt).toLocaleString() : "—"}
              />
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading flex items-center gap-2 text-base font-semibold tracking-tight">
            <FileStack className="text-primary size-5" aria-hidden />
            Documents
          </h2>
          {gotBoth ? (
            <span className="text-success inline-flex items-center gap-1 text-xs font-medium">
              <CheckCircle2 className="size-4" aria-hidden />
              Passport + photo present
            </span>
          ) : (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <AlertTriangle className="size-4" aria-hidden />
              Both required for submission
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DocumentUploadSlot
            label="Passport (bio page)"
            description="JPEG / PNG / single-page PDF · 8MB max"
            currentDoc={passport}
            docType="passport_copy"
            applicationId={applicationId}
            uploading={uploading === "passport_copy"}
            onUpload={(f) => void onUpload("passport_copy", f)}
          />
          <DocumentUploadSlot
            label="Personal photo"
            description="JPEG or PNG · 8MB max"
            currentDoc={photo}
            docType="personal_photo"
            applicationId={applicationId}
            uploading={uploading === "personal_photo"}
            onUpload={(f) => void onUpload("personal_photo", f)}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="rounded-none"
            disabled={!canExtract}
            onClick={() => void onExtract()}
          >
            {extracting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 size-4" aria-hidden />
            )}
            Extract passport details
          </Button>
          <p className="text-muted-foreground text-xs">
            Current: <span className="font-mono">{app.passportExtraction.status}</span>
          </p>
        </div>
      </section>

      <ApplicantReview
        applicant={app.applicant}
        extraction={extractResult?.extraction ?? null}
        readiness={readiness}
        missing={extractResult?.validation?.missingRequiredFields ?? []}
      />

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

function DtDd({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-foreground font-medium">{label}</dt>
      <dd className={mono ? "font-mono text-xs break-all" : "font-mono text-xs"}>{value}</dd>
    </div>
  );
}

function DocumentUploadSlot({
  label,
  description,
  currentDoc,
  docType,
  applicationId,
  uploading,
  onUpload,
}: {
  label: string;
  description: string;
  currentDoc: PublicDocument | null;
  docType: DocType;
  applicationId: string;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const [pending, setPending] = useState<File | null>(null);
  const tooLarge = pending ? pending.size > UPLOAD_MAX_BYTES : false;
  const inputId = `file-${docType}`;
  return (
    <div className="border-border border p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      {currentDoc ? (
        <div className="text-xs space-y-1">
          <p className="text-foreground">
            <span className="font-mono break-all">{currentDoc.originalFilename ?? currentDoc.id}</span>
          </p>
          <p className="text-muted-foreground">
            {currentDoc.status} ·{" "}
            {currentDoc.byteLength ? `${(currentDoc.byteLength / 1024).toFixed(1)} KB` : "?"}
          </p>
          <div className="flex gap-3 pt-1">
            <a
              href={`/api/applications/${applicationId}/documents/${currentDoc.id}/preview`}
              target="_blank"
              rel="noreferrer"
              className="text-link hover:underline"
            >
              Preview
            </a>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">Not uploaded yet.</p>
      )}

      <div className="space-y-2">
        <Label htmlFor={inputId} className="sr-only">
          {label}
        </Label>
        <input
          id={inputId}
          type="file"
          accept={MIME_BY_TYPE[docType]}
          onChange={(e) => setPending(e.target.files?.[0] ?? null)}
          className="text-muted-foreground block w-full text-xs file:mr-3 file:border file:border-border file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
        />
        {tooLarge ? (
          <p className="text-destructive text-xs">File exceeds 8MB limit.</p>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="rounded-none"
          disabled={!pending || uploading || tooLarge}
          onClick={() => {
            if (pending) {
              onUpload(pending);
              setPending(null);
            }
          }}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : "Upload"}
        </Button>
      </div>
    </div>
  );
}

function ApplicantReview({
  applicant,
  extraction,
  readiness,
  missing,
}: {
  applicant: ApplicantProfile;
  extraction: ExtractResponse["extraction"] | null;
  readiness: string | null;
  missing: string[];
}) {
  const rows: Array<{ label: string; key: keyof ApplicantProfile; value: string | null }> = [
    { label: "Full name", key: "fullName", value: applicant.fullName },
    { label: "Date of birth", key: "dateOfBirth", value: applicant.dateOfBirth },
    { label: "Nationality", key: "nationality", value: applicant.nationality },
    { label: "Passport number", key: "passportNumber", value: applicant.passportNumber },
    { label: "Passport expiry", key: "passportExpiryDate", value: applicant.passportExpiryDate },
    { label: "Place of birth", key: "placeOfBirth", value: applicant.placeOfBirth },
    { label: "Profession", key: "profession", value: applicant.profession },
    { label: "Address", key: "address", value: applicant.address },
    { label: "Phone", key: "phone", value: applicant.phone },
  ];
  const readinessLabel = (() => {
    switch (readiness) {
      case "ready":
        return { text: "Ready to continue", tone: "success" };
      case "blocked_validation":
        return { text: "Needs attention before checkout", tone: "warn" };
      case "blocked_missing_docs":
        return { text: "Upload remaining documents", tone: "warn" };
      default:
        return null;
    }
  })();

  return (
    <section className="border-border bg-card space-y-4 border p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-semibold tracking-tight">Applicant details</h2>
        {readinessLabel ? (
          <span
            className={
              "text-xs font-medium inline-flex items-center gap-1 " +
              (readinessLabel.tone === "success"
                ? "text-success"
                : "text-destructive")
            }
          >
            {readinessLabel.tone === "success" ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : (
              <AlertTriangle className="size-4" aria-hidden />
            )}
            {readinessLabel.text}
          </span>
        ) : null}
      </div>
      {extraction ? (
        <p className="text-muted-foreground text-xs">
          Extraction {extraction.status} · attempts {extraction.attemptsUsed}
          {extraction.ocrMissingFields.length > 0
            ? ` · OCR missing: ${extraction.ocrMissingFields.join(", ")}`
            : ""}
        </p>
      ) : null}
      {missing.length > 0 ? (
        <p className="text-destructive text-xs">
          Required fields missing: {missing.join(", ")}
        </p>
      ) : null}
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.key}>
            <dt className="text-foreground text-xs font-medium">{r.label}</dt>
            <dd className="mt-1">
              <Input
                type="text"
                readOnly
                value={r.value ?? ""}
                placeholder="—"
                className="rounded-none"
              />
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-xs">
        Read-only preview. Manual edit + provenance tracking lands in the next iteration.
      </p>
    </section>
  );
}
