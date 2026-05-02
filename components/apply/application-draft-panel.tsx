"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileStack,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ApplyJourneyStepBar } from "@/components/apply/apply-journey-step-bar";
import { ClientButton } from "@/components/client/client-button";
import { ClientField } from "@/components/client/client-field";
import { ClientInput } from "@/components/client/client-input";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import type { PublicApplication } from "@/lib/applications/public-application";
import { CheckoutOrderRecap } from "./checkout-order-recap";
import { PaddleCheckoutButton } from "./paddle-checkout-button";
import {
  computeValidation,
  formatIsoDateAsDdMmYyyy,
  parseDobInputToIsoUtc,
  type Readiness,
} from "@/lib/documents/validation-readiness";

type ApplicantProfile = PublicApplication["applicant"];

/** Row keys for the applicant form; `"email"` maps to `application.guestEmail` on the server. */
type ApplicantProfileFieldKey = keyof ApplicantProfile | "email";

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
    paymentReadiness?: Readiness;
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

function applicantFieldValue(
  applicant: ApplicantProfile,
  key: ApplicantProfileFieldKey,
  guestEmail: string | null,
): string {
  if (key === "email") return guestEmail ?? "";
  if (key === "dateOfBirth") return formatIsoDateAsDdMmYyyy(applicant.dateOfBirth ?? null);
  if (key === "passportExpiryDate") return formatIsoDateAsDdMmYyyy(applicant.passportExpiryDate ?? null);
  return applicant[key] ?? "";
}

/** Remount profile form when server-driven applicant / extraction data changes (avoids setState-in-effect). */
function applicantFormResetKey(
  applicant: ApplicantProfile,
  extraction: ExtractResponse["extraction"] | null,
  guestEmail: string | null,
): string {
  const stable = [
    applicant.fullName ?? "",
    applicant.dateOfBirth ?? "",
    applicant.nationality ?? "",
    applicant.passportNumber ?? "",
    applicant.passportExpiryDate ?? "",
    applicant.placeOfBirth ?? "",
    applicant.profession ?? "",
    applicant.address ?? "",
    applicant.phone ?? "",
    guestEmail ?? "",
  ].join("\u001e");
  const ex = extraction
    ? `${extraction.documentId ?? ""}\u001e${extraction.attemptsUsed}\u001e${extraction.status}`
    : "";
  return `${stable}\u001e${ex}`;
}

function customerFacingExtractionLabel(status: string | null | undefined): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "running":
      return "In progress";
    case "succeeded":
      return "Completed";
    case "needs_manual":
      return "Needs manual review";
    case "failed":
      return "Needs manual entry";
    default:
      return "Not started";
  }
}

export function ApplicationDraftPanel({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [app, setApp] = useState<PublicApplication | null>(null);
  const [docs, setDocs] = useState<PublicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState<DocType | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractResponse | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }): Promise<{
      application: PublicApplication;
      documents: PublicDocument[];
    } | null> => {
      const silent = opts?.silent === true;
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      const [appRes, docsRes] = await Promise.all([
        fetchApiEnvelope<{ application: PublicApplication }>(apiHref(`/applications/${applicationId}`)),
        fetchApiEnvelope<{ documents: PublicDocument[] }>(apiHref(`/applications/${applicationId}/documents`)),
      ]);
      if (!silent) setLoading(false);
      if (!appRes.ok) {
        setApp(null);
        setError(appRes.error.message);
        return null;
      }
      const nextApp = appRes.data.application;
      setApp(nextApp);
      let nextDocs: PublicDocument[] = [];
      if (docsRes.ok) {
        nextDocs = docsRes.data.documents;
        setDocs(nextDocs);
      }
      return { application: nextApp, documents: nextDocs };
    },
    [applicationId],
  );

  const cancelCheckout = useCallback(async () => {
    setActionMsg(null);
    const res = await fetchApiEnvelope(apiHref(`/applications/${applicationId}/checkout-cancel`), {
      method: "POST",
    });
    if (!res.ok) {
      setActionMsg(res.error.message);
      return;
    }
    setCountdown(null);
    setActionMsg("Checkout cancelled.");
    await load({ silent: true });
  }, [applicationId, load]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  // Poll for payment confirmation (webhook updates DB; client overlay success is not authoritative).
  useEffect(() => {
    if (app?.paymentStatus === "checkout_created") {
      const interval = setInterval(() => void load({ silent: true }), 2000);
      return () => clearInterval(interval);
    }
  }, [app?.paymentStatus, load]);

  // When the backend confirms payment, move the user into the submitted flow (where we show account-linking UX).
  useEffect(() => {
    if (app?.paymentStatus !== "paid") return;
    router.replace(`/apply/applications/${encodeURIComponent(applicationId)}/submitted`);
  }, [app?.paymentStatus, applicationId, router]);

  // Checkout TTL timer — cancel when countdown reaches zero.
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (countdown === 0) {
      queueMicrotask(() => void cancelCheckout());
    }
  }, [countdown, cancelCheckout]);

  const passport = useMemo(() => latestByType(docs, "passport_copy"), [docs]);
  const photo = useMemo(() => latestByType(docs, "personal_photo"), [docs]);

  const attemptsUsed = extractResult?.extraction.attemptsUsed ?? 0;
  const attemptsLeft = Math.max(0, 2 - attemptsUsed);

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
    const res = await fetch(apiHref(`/applications/${applicationId}/documents/upload`), {
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
    const data = await load({ silent: true });
    if (type === "passport_copy" && data && latestByType(data.documents, "passport_copy")) {
      void runExtract();
    }
  }

  async function runExtract() {
    setExtracting(true);
    setActionMsg(null);
    const res = await fetchApiEnvelope<ExtractResponse>(apiHref(`/applications/${applicationId}/extract`), {
      method: "POST",
    });
    setExtracting(false);
    if (!res.ok) {
      setActionMsg(res.error.message);
      await load({ silent: true });
      return;
    }
    setExtractResult(res.data);
    const s = res.data.extraction.status;
    if (s === "succeeded") {
      setActionMsg("We filled in what we could. Review your details below.");
    } else if (s === "needs_manual") {
      setActionMsg("We couldn’t read everything. Please enter the remaining details manually.");
    } else {
      setActionMsg("We couldn’t read your passport. Please enter the details manually.");
    }
    await load({ silent: true });
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
      <div className="space-y-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <p className="text-error text-sm leading-relaxed">{error ?? "Not found."}</p>
        <p className="text-muted-foreground text-sm">
          Guests need the same browser session (resume cookie). Signed-in users must own this draft. Lost the
          cookie?{" "}
          <Link href="/apply/track" className="text-link font-medium hover:underline">
            Look up status with email or phone
          </Link>
          .
        </p>
        <ClientButton type="button" variant="outline" className="rounded-none" onClick={() => void load()}>
          <RefreshCw className="mr-2 size-4" aria-hidden />
          Retry
        </ClientButton>
        <Link href="/" className="text-link ml-4 text-sm font-medium">
          Start over
        </Link>
      </div>
    );
  }

  const gotBoth = Boolean(passport && photo);

  const validationEmail = app.isGuest ? app.guestEmail : "signed-in";

  const { readiness, paymentReadiness, requiredFieldsMissing: missing } = computeValidation({
    profile: { ...app.applicant, email: validationEmail },
    uploads: {
      passportCopyPresent: Boolean(passport),
      personalPhotoPresent: Boolean(photo),
    },
    now: new Date(),
  });

  const journeyStep = (() => {
    if (app.paymentStatus === "checkout_created") return 4 as const;
    if (app.paymentStatus === "paid") return 4 as const;
    return paymentReadiness === "ready" ? (4 as const) : (3 as const);
  })();

  return (
    <div className="space-y-8">
      {actionMsg ? (
        <p className="text-accent-foreground border-accent/30 bg-accent/15 text-sm border-l-4 border-l-accent px-3 py-2">
          {actionMsg}
        </p>
      ) : null}

      <section className="space-y-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
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
              Passport and photo are required before we can submit to authorities; you can pay first.
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

        <div className="flex flex-wrap items-center gap-2 pt-2">
          {extracting ? (
            <p className="text-muted-foreground flex items-center gap-2 text-xs" role="status">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              <span>Reading passport…</span>
            </p>
          ) : null}
          {!extracting ? (
            <p className="text-muted-foreground text-xs">
              Passport OCR:{" "}
              <span className="font-medium">{customerFacingExtractionLabel(app.passportExtraction.status)}</span>
              {attemptsLeft > 0 && app.passportExtraction.status !== "succeeded"
                ? ` · ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left`
                : ""}
            </p>
          ) : null}
        </div>
        {attemptsLeft === 0 && app.passportExtraction.status !== "succeeded" ? (
          <p className="text-muted-foreground text-sm">
            We’ve tried twice. Please enter your details manually below.
          </p>
        ) : null}
      </section>

      <ApplicantReview
        key={applicantFormResetKey(app.applicant, extractResult?.extraction ?? null, app.guestEmail)}
        applicationId={applicationId}
        nationalityCode={app.nationalityCode}
        applicant={app.applicant}
        guestEmail={app.guestEmail}
        isGuest={app.isGuest}
        extraction={extractResult?.extraction ?? null}
        readiness={readiness}
        paymentReadiness={paymentReadiness}
        missing={missing}
        locked={app.checkoutState === "pending" || app.paymentStatus === "paid"}
        onSaved={() => void load({ silent: true })}
      />

      {/* Payment Section */}
      <section className="space-y-4">
        {paymentReadiness === "ready" && app.paymentStatus === "unpaid" && (
          <div className="space-y-4 rounded-[12px] border-2 border-primary bg-primary/5 p-5 shadow-[0_8px_32px_rgba(1,32,49,0.08)] sm:p-6">
            <h2 className="font-heading text-lg font-bold">Secure payment</h2>
            <p className="text-sm text-muted-foreground">
              Your application is complete and ready for submission. Please pay the service fee to begin processing.
            </p>
            <CheckoutOrderRecap application={app} />
            <PaddleCheckoutButton
              applicationId={applicationId}
              onExternalRedirect={() =>
                setActionMsg("Redirecting to our payment partner to complete checkout securely…")
              }
              onOverlayClosed={() => void load({ silent: true })}
              onSuccess={() => {
                setCountdown(null);
                setActionMsg("Payment submitted. Confirming with our systems…");
                router.push(`/apply/applications/${encodeURIComponent(applicationId)}/submitted`);
              }}
              onCancel={() => {
                // We keep the state as checkout_created until they manually cancel or TTL expires
                // But we start the timer if it wasn't already running
                if (countdown === null) setCountdown(600);
              }}
              onError={(msg) => setActionMsg(msg)}
            />
          </div>
        )}

        {app.paymentStatus === "checkout_created" && (
          <div className="space-y-6 rounded-[12px] border-2 border-primary bg-primary/5 p-5 shadow-[0_8px_32px_rgba(1,32,49,0.08)] sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-bold">Complete your payment</h2>
                <p className="text-sm text-muted-foreground">Checkout is in progress.</p>
              </div>
              {countdown !== null && (
                <div className="bg-primary text-primary-foreground px-4 py-2 font-mono text-xl font-bold flex items-center gap-2">
                  <span className="text-xs uppercase opacity-80">Expires:</span>
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                </div>
              )}
            </div>

            <CheckoutOrderRecap application={app} />

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <PaddleCheckoutButton
                  applicationId={applicationId}
                  onExternalRedirect={() =>
                    setActionMsg("Redirecting to our payment partner to complete checkout securely…")
                  }
                  onOverlayClosed={() => void load({ silent: true })}
                  onSuccess={() => {
                    setCountdown(null);
                    setActionMsg("Payment submitted. Confirming with our systems…");
                    router.push(`/apply/applications/${encodeURIComponent(applicationId)}/submitted`);
                  }}
                  onError={(msg) => setActionMsg(msg)}
                />
              </div>
              <ClientButton
                variant="ghost"
                className="rounded-none hover:bg-destructive/10 hover:text-destructive"
                onClick={cancelCheckout}
              >
                Cancel & Reset
              </ClientButton>
            </div>
          </div>
        )}

        {app.paymentStatus === "paid" && (
          <div className="bg-success/10 border border-success/30 p-5 flex items-center gap-3">
            <CheckCircle2 className="text-success size-6" />
            <div>
              <p className="text-success font-bold">Payment Confirmed</p>
              <p className="text-xs text-success/80 italic">
                We’re confirming your payment and starting processing.
              </p>
            </div>
          </div>
        )}
      </section>


      <p className="text-muted-foreground text-center text-xs">
        <Link href="/" className="text-link hover:underline">
          Start another draft
        </Link>
        {" · "}
        <Link href="/portal/track" className="hover:text-foreground">
          Portal
        </Link>
      </p>

      <ApplyJourneyStepBar
        step={journeyStep}
        totalSteps={5}
        title={journeyStep === 4 ? "Review & pay" : "Upload documents"}
        subtitle={
          journeyStep === 4
            ? "Confirm your details, then pay securely to submit."
            : "Upload what we ask for, then confirm your passport details."
        }
      />
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  /** Prefer selfie for portrait; rear camera for passport and supporting images. */
  const cameraFacing = docType === "personal_photo" ? "user" : "environment";

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPending(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3 rounded-[12px] border border-border bg-card/80 p-4 shadow-sm">
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
              href={apiHref(`/applications/${applicationId}/documents/${currentDoc.id}/preview`)}
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

      <ClientField id={inputId} label={label} labelClassName="sr-only">
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture={cameraFacing}
          onChange={handleFileChosen}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input
            id={inputId}
            type="file"
            accept={MIME_BY_TYPE[docType]}
            onChange={handleFileChosen}
            className="text-muted-foreground block min-w-0 flex-1 text-xs file:mr-3 file:border file:border-border file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
          />
          <ClientButton
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-none"
            disabled={uploading}
            onClick={() => cameraInputRef.current?.click()}
            aria-label={`Take a photo: ${label}`}
          >
            <Camera className="size-4" aria-hidden />
            Take photo
          </ClientButton>
        </div>
        {tooLarge ? (
          <p className="text-error text-xs">File exceeds 8MB limit.</p>
        ) : null}
        <ClientButton
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
        </ClientButton>
      </ClientField>
    </div>
  );
}

function ApplicantReview({
  applicationId,
  nationalityCode,
  applicant,
  guestEmail,
  isGuest,
  extraction,
  readiness,
  paymentReadiness,
  missing,
  locked,
  onSaved,
}: {
  applicationId: string;
  nationalityCode: string;
  applicant: ApplicantProfile;
  guestEmail: string | null;
  isGuest: boolean;
  extraction: ExtractResponse["extraction"] | null;
  readiness: string | null;
  paymentReadiness: Readiness;
  missing: string[];
  locked: boolean;
  onSaved: () => void;
}) {
  const router = useRouter();
  const prefilled = new Set<string>(Object.keys(extraction?.prefill ?? {}));

  const ROWS: Array<{
    label: string;
    key: ApplicantProfileFieldKey;
    apiKey: string;
    placeholder?: string;
    hint?: string;
  }> = [
    { label: "Full name", key: "fullName", apiKey: "fullName", placeholder: "e.g. John Smith" },
    { label: "Date of birth", key: "dateOfBirth", apiKey: "dateOfBirth", placeholder: "DD-MM-YYYY" },
    { label: "Nationality", key: "nationality", apiKey: "applicantNationality", placeholder: "e.g. Egyptian" },
    { label: "Passport number", key: "passportNumber", apiKey: "passportNumber", placeholder: "e.g. A12345678" },
    { label: "Passport expiry", key: "passportExpiryDate", apiKey: "passportExpiryDate", placeholder: "DD-MM-YYYY" },
    { label: "Place of birth", key: "placeOfBirth", apiKey: "placeOfBirth", placeholder: "e.g. Cairo" },
    { label: "Profession", key: "profession", apiKey: "profession", placeholder: "e.g. Engineer" },
    { label: "Address", key: "address", apiKey: "address", placeholder: "Full home address" },
    { label: "Phone", key: "phone", apiKey: "phone", placeholder: "+1 555 000 0000" },
    {
      label: "Email",
      key: "email",
      apiKey: "guestEmail",
      placeholder: "you@example.com",
      hint: "Optional — leave blank to use your account email for updates.",
    },
  ];

  const initial: Record<string, string> = {};
  for (const r of ROWS) initial[r.apiKey] = applicantFieldValue(applicant, r.key, guestEmail);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Detect dirty state vs initial
  const dirty = ROWS.some((r) => (values[r.apiKey] ?? "") !== (initial[r.apiKey] ?? ""));

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    if (isGuest) {
      const em = (values.guestEmail ?? "").trim();
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setSaveError("Please enter a valid email address.");
        setSaving(false);
        return;
      }
    }
    const patch: Record<string, string> = {};
    for (const r of ROWS) {
      const v = values[r.apiKey] ?? "";
      if (v === (initial[r.apiKey] ?? "")) continue;
      if (r.apiKey === "dateOfBirth" || r.apiKey === "passportExpiryDate") {
        const trimmed = v.trim();
        if (trimmed === "") {
          patch[r.apiKey] = "";
        } else {
          const iso = parseDobInputToIsoUtc(trimmed);
          if (!iso) {
            setSaveError(
              r.apiKey === "dateOfBirth"
                ? "Date of birth must be DD-MM-YYYY."
                : "Passport expiry must be DD-MM-YYYY.",
            );
            setSaving(false);
            return;
          }
          patch[r.apiKey] = iso;
        }
      } else {
        patch[r.apiKey] = v;
      }
    }
    if (Object.keys(patch).length === 0) {
      setSaving(false);
      setSaveMsg("No changes to save.");
      return;
    }
    const res = await fetchApiEnvelope<{ application: unknown }>(
      apiHref(`/applications/${applicationId}/profile`),
      { method: "PATCH", body: JSON.stringify(patch) }
    );
    setSaving(false);
    if (!res.ok) {
      const details = res.error.details as { fieldErrors?: Record<string, string[]> } | undefined;
      const fieldErrs = details?.fieldErrors;
      if (fieldErrs && typeof fieldErrs === "object" && Object.keys(fieldErrs).length > 0) {
        const issues = Object.entries(fieldErrs)
          .map(([k, v]) => {
             const row = ROWS.find(r => r.apiKey === k);
             return `${row ? row.label : k}: ${Array.isArray(v) ? v[0] : v}`;
          })
          .join(" | ");
        setSaveError(`Validation failed → ${issues}`);
      } else {
        setSaveError(res.error.message);
      }
      return;
    }
    setSaveMsg("Changes saved.");
    onSaved();
  }

  const readinessLabel = (() => {
    if (paymentReadiness === "ready" && readiness !== "ready") {
      return {
        text: "Ready for payment — add passport and photo when you can",
        tone: "success" as const,
      };
    }
    switch (readiness) {
      case "ready":
        return { text: "Ready for payment", tone: "success" as const };
      case "blocked_validation":
        return { text: "Needs attention before checkout", tone: "warn" as const };
      case "blocked_missing_docs":
        return { text: "Upload remaining documents", tone: "warn" as const };
      case "blocked_missing_required_fields":
        return { text: "Complete required details", tone: "warn" as const };
      default:
        return null;
    }
  })();

  return (
    <section className="space-y-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-semibold tracking-tight">Applicant details</h2>
        {readinessLabel ? (
          <span
            className={
              "text-xs font-medium inline-flex items-center gap-1 " +
              (readinessLabel.tone === "success" ? "text-success" : "text-error")
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

      {missing.length > 0 && (
        <div className="border-error bg-error/5 border-l-4 px-3 py-2 text-sm">
          <p className="text-error font-semibold">Required fields missing:</p>
          <p className="mt-1 text-xs text-error/90">{missing.join(", ")}</p>
        </div>
      )}

      {extraction && (
        <p className="text-muted-foreground text-xs">
          Auto-fill {extraction.status} · {extraction.attemptsUsed} attempt(s)
          {extraction.ocrMissingFields.length > 0
            ? ` · could not read: ${extraction.ocrMissingFields.join(", ")}`
            : ""}
        </p>
      )}

      {locked && (
        <p className="text-muted-foreground bg-muted px-3 py-2 text-xs rounded">
          Fields are locked while payment is in progress.
        </p>
      )}

      <dl className="grid gap-3 sm:grid-cols-2">
        {ROWS.map((r) => {
          const isMissing = missing.includes(r.key);
          const wasOcr = prefilled.has(r.key);
          return (
            <div key={r.key}>
              <dt className="text-foreground flex flex-col gap-0.5 text-xs font-medium">
                <span className="flex flex-wrap items-center gap-1">
                  {r.label}
                  {wasOcr && (
                    <span className="text-[10px] text-primary bg-primary/10 px-1 rounded">Auto-filled</span>
                  )}
                </span>
                {r.hint && !isGuest ? (
                  <span className="text-muted-foreground text-[10px] font-normal leading-snug">{r.hint}</span>
                ) : null}
              </dt>
              <dd className="mt-1">
                <ClientInput
                  type={r.apiKey === "guestEmail" ? "email" : "text"}
                  autoComplete={r.apiKey === "guestEmail" ? "email" : undefined}
                  readOnly={locked}
                  value={values[r.apiKey] ?? ""}
                  placeholder={r.placeholder ?? "—"}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [r.apiKey]: e.target.value }))
                  }
                  invalid={isMissing && !values[r.apiKey]}
                  className={[
                    "rounded-[5px]",
                    locked ? "cursor-not-allowed opacity-70" : "",
                  ].join(" ")}
                />
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <ClientButton
          type="submit"
          variant="outline"
          brand="cta"
          className="rounded-none"
          onClick={() =>
            router.push(`/apply/start?nationality=${encodeURIComponent(nationalityCode)}`)
          }
        >
          Previous
        </ClientButton>
        {!locked ? (
          <>
            <ClientButton
              type="button"
              brand="cta"
              disabled={!dirty || saving}
              onClick={() => void handleSave()}
              className="rounded-none"
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Next"}
            </ClientButton>
            {saveMsg ? <p className="text-success text-xs">{saveMsg}</p> : null}
            {saveError ? <p className="text-error text-xs">{saveError}</p> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
