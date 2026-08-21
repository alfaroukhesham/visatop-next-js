"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { ClientInput } from "@/components/client/client-input";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import { APPLY_STEP3_VALIDATION_DISABLED } from "@/lib/apply/apply-flow-config";
import { parseDobInputToIsoUtc, type Readiness } from "@/lib/documents/validation-readiness";
import { DATE_API_KEYS, type ApplicantProfile, type ApplicantProfileFieldKey, type ExtractResponse } from "./types";
import { applicantFieldValue, applyDateMask } from "./utils";

const APPLICANT_ROWS: Array<{
  label: string;
  key: ApplicantProfileFieldKey;
  apiKey: string;
  placeholder?: string;
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
];

function buildReadinessLabel(readiness: string | null, paymentReadiness: Readiness) {
  if (APPLY_STEP3_VALIDATION_DISABLED && paymentReadiness === "ready") {
    return { text: "Ready for payment", tone: "success" as const };
  }
  if (paymentReadiness === "ready" && readiness !== "ready") {
    return { text: "Ready for payment — add passport and photo when you can", tone: "success" as const };
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
}

export function ApplicantReview({
  applicationId,
  nationalityCode,
  applicant,
  guestEmail,
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
  extraction: ExtractResponse["extraction"] | null;
  readiness: string | null;
  paymentReadiness: Readiness;
  missing: string[];
  locked: boolean;
  onSaved: () => void;
}) {
  const router = useRouter();
  const prefilled = new Set<string>(Object.keys(extraction?.prefill ?? {}));

  const initial: Record<string, string> = {};
  for (const r of APPLICANT_ROWS) initial[r.apiKey] = applicantFieldValue(applicant, r.key, guestEmail);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty = APPLICANT_ROWS.some((r) => (values[r.apiKey] ?? "") !== (initial[r.apiKey] ?? ""));

  const paymentPath = `/apply/applications/${encodeURIComponent(applicationId)}/payment`;
  const canContinueToPayment = !locked && paymentReadiness === "ready";

  function goToPayment() {
    router.push(paymentPath);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    const patch: Record<string, string> = {};
    for (const r of APPLICANT_ROWS) {
      const v = values[r.apiKey] ?? "";
      if (v === (initial[r.apiKey] ?? "")) continue;
      if (r.apiKey === "dateOfBirth" || r.apiKey === "passportExpiryDate") {
        const trimmed = v.trim();
        if (trimmed === "") {
          patch[r.apiKey] = "";
        } else if (APPLY_STEP3_VALIDATION_DISABLED) {
          const iso = parseDobInputToIsoUtc(trimmed);
          if (iso) patch[r.apiKey] = iso;
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
      { method: "PATCH", body: JSON.stringify(patch) },
    );
    setSaving(false);
    if (!res.ok) {
      const details = res.error.details as { fieldErrors?: Record<string, string[]> } | undefined;
      const fieldErrs = details?.fieldErrors;
      if (fieldErrs && typeof fieldErrs === "object" && Object.keys(fieldErrs).length > 0) {
        const issues = Object.entries(fieldErrs)
          .map(([k, v]) => {
            const row = APPLICANT_ROWS.find((r) => r.apiKey === k);
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
    if (canContinueToPayment) {
      goToPayment();
    }
  }

  const readinessLabel = buildReadinessLabel(readiness, paymentReadiness);

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
            aria-label={readinessLabel.tone === "success" ? readinessLabel.text : undefined}
          >
            {readinessLabel.tone === "success" ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : (
              <AlertTriangle className="size-4" aria-hidden />
            )}
            {readinessLabel.tone === "success" ? null : readinessLabel.text}
          </span>
        ) : null}
      </div>

      {!APPLY_STEP3_VALIDATION_DISABLED && missing.length > 0 && (
        <div className="border-error bg-error/5 border-b-2 px-3 py-2 text-sm">
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
        {APPLICANT_ROWS.map((r) => {
          const isMissing = !APPLY_STEP3_VALIDATION_DISABLED && missing.includes(r.key);
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
              </dt>
              <dd className="mt-1">
                <ClientInput
                  type="text"
                  inputMode={DATE_API_KEYS.has(r.apiKey) ? "numeric" : undefined}
                  maxLength={DATE_API_KEYS.has(r.apiKey) ? 10 : undefined}
                  readOnly={locked}
                  value={values[r.apiKey] ?? ""}
                  placeholder={r.placeholder ?? "—"}
                  onChange={(e) => {
                    const v = DATE_API_KEYS.has(r.apiKey)
                      ? applyDateMask(e.target.value)
                      : e.target.value;
                    setValues((prev) => ({ ...prev, [r.apiKey]: v }));
                  }}
                  invalid={isMissing && !values[r.apiKey]}
                  className={["rounded-[5px]", locked ? "cursor-not-allowed opacity-70" : ""].join(" ")}
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
              disabled={saving || (!dirty && !canContinueToPayment)}
              onClick={() => {
                if (!dirty && canContinueToPayment) {
                  goToPayment();
                  return;
                }
                void handleSave();
              }}
              className="rounded-none"
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {saving ? "Saving…" : !dirty && canContinueToPayment ? "Continue to payment" : "Next"}
            </ClientButton>
            {saveMsg ? <p className="text-success text-xs">{saveMsg}</p> : null}
            {saveError ? <p className="text-error text-xs">{saveError}</p> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
