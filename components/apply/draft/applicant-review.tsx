"use client";

import { useState, type FC } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { DoubleDecision } from "@/components/client/double-decision";
import { ClientInput } from "@/components/client/client-input";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import { APPLY_STEP3_VALIDATION_DISABLED } from "@/lib/apply/apply-flow-config";
import { customerFacingOcrMessage } from "@/lib/apply/ocr-customer-copy";
import { PAY_BLOCKED_MISSING_DOCS_COPY } from "@/lib/apply/payment-copy";
import { paymentReviewNavState } from "@/lib/apply/payment-review-nav";
import { parseDobInputToIsoUtc, type Readiness } from "@/lib/documents/validation-readiness";
import { cn } from "@/lib/utils";
import { DATE_API_KEYS, type ApplicantProfile, type ApplicantProfileFieldKey, type ExtractResponse } from "./types";
import { PhoneCountryField, type TPhoneNationalityOption } from "./phone-country-field";

import { applicantFieldValue, applyDateMask } from "./utils";

const APPLICANT_ROWS_WITHOUT_PHONE: Array<{
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
];

const APPLICANT_ROWS = [
  ...APPLICANT_ROWS_WITHOUT_PHONE,
  { label: "Phone", key: "phone" as const, apiKey: "phone", placeholder: "+1 555 000 0000" },
];

const buildReadinessLabel = (
  readiness: string | null,
  paymentReadiness: Readiness,
) => {
  if (paymentReadiness !== "ready") {
    return { text: PAY_BLOCKED_MISSING_DOCS_COPY, tone: "warn" as const };
  }
  if (APPLY_STEP3_VALIDATION_DISABLED) {
    return { text: "Continue to payment", tone: "neutral" as const };
  }
  switch (readiness) {
    case "ready":
      return { text: "Continue to payment", tone: "neutral" as const };
    case "blocked_validation":
      return { text: "Needs attention before checkout", tone: "warn" as const };
    case "blocked_missing_docs":
      return { text: "Upload remaining documents", tone: "warn" as const };
    case "blocked_missing_required_fields":
      return { text: "Complete required details", tone: "warn" as const };
    default:
      return null;
  }
};

export interface IApplicantReviewProps {
  applicationId: string;
  paymentApplicationId?: string;
  nationalityCode: string;
  nationalityName: string;
  nationalities: TPhoneNationalityOption[];
  applicant: ApplicantProfile;
  guestEmail: string | null;
  extraction: ExtractResponse["extraction"] | null;
  readiness: string | null;
  paymentReadiness: Readiness;
  missing: string[];
  documentsReady: boolean;
  passportUploaded: boolean;
  extractPending: boolean;
  waitForPassportExtract: () => Promise<void>;
  locked: boolean;
  onSaved: () => void;
}

export const ApplicantReview: FC<IApplicantReviewProps> = ({
  applicationId,
  paymentApplicationId,
  nationalityCode,
  nationalityName,
  nationalities,
  applicant,
  guestEmail,
  extraction,
  readiness,
  paymentReadiness,
  missing,
  documentsReady,
  passportUploaded,
  extractPending,
  waitForPassportExtract,
  locked,
  onSaved,
}) => {
  const t = useCustomerT();
  const router = useRouter();
  const prefilled = new Set<string>(Object.keys(extraction?.prefill ?? {}));

  const initial: Record<string, string> = {};
  for (const r of APPLICANT_ROWS) initial[r.apiKey] = applicantFieldValue(applicant, r.key, guestEmail);
  if (!applicant.nationality) initial.applicantNationality = nationalityName;

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty = APPLICANT_ROWS.some((r) => (values[r.apiKey] ?? "") !== (initial[r.apiKey] ?? ""));

  const paymentPath = `/apply/applications/${encodeURIComponent(paymentApplicationId ?? applicationId)}/payment`;
  const canContinueToPayment = !locked && paymentReadiness === "ready";

  const goToPayment = async () => {
    await waitForPassportExtract();
    router.push(paymentPath);
  };

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
    if (canContinueToPayment && passportUploaded) {
      void goToPayment();
    }
  }

  const readinessLabel = buildReadinessLabel(readiness, paymentReadiness);
  const isSecondary = !documentsReady;

  async function onNext() {
    if (locked) return;
    setSaveError(null);
    const nav = paymentReviewNavState({
      passportUploaded,
      extractPending,
      paymentReady: canContinueToPayment,
    });
    if (nav === "need_passport") {
      setSaveError(t("draft.passportRequiredToPay"));
      return;
    }
    if (nav === "wait_extract") {
      await goToPayment();
      return;
    }
    if (nav === "blocked") {
      setSaveError(PAY_BLOCKED_MISSING_DOCS_COPY);
      return;
    }
    if (!dirty) {
      await goToPayment();
      return;
    }
    void handleSave();
  }

  return (
    <section
      className={cn(
        "space-y-4 rounded-3xl border bg-card p-5 shadow-[0_18px_48px_rgba(1,32,49,0.07)] sm:p-6 md:p-8",
        isSecondary ? "border-border/60 bg-muted/15" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2
            className={cn(
              "font-heading text-xl font-semibold tracking-tight",
              isSecondary && "text-muted-foreground",
            )}
          >
            {t("draft.applicantDetailsTitle")}
          </h2>
          {isSecondary ? (
            <p className="text-muted-foreground text-sm font-normal">
              {passportUploaded
                ? t("draft.applicantSecondaryPassportUploaded")
                : t("draft.applicantSecondaryOptional")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {readinessLabel ? (
            <span
              className={cn(
                "text-xs font-medium inline-flex items-center gap-1",
                readinessLabel.tone === "warn" ? "text-error" : "text-muted-foreground",
              )}
            >
              {readinessLabel.tone === "warn" ? (
                <AlertTriangle className="size-4" aria-hidden />
              ) : null}
              {readinessLabel.text}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 pt-2">
      {!APPLY_STEP3_VALIDATION_DISABLED && missing.length > 0 && (
        <div className="border-error bg-error/5 border-b-2 px-3 py-2 text-sm">
          <p className="text-error font-semibold">Required fields missing:</p>
          <p className="mt-1 text-xs text-error/90">{missing.join(", ")}</p>
        </div>
      )}

      {extraction ? (
        <p className="text-muted-foreground text-xs">
          {customerFacingOcrMessage(extraction.status)}
        </p>
      ) : null}

      {locked && (
        <p className="text-muted-foreground bg-muted px-3 py-2 text-xs rounded">
          Fields are locked while payment is in progress.
        </p>
      )}

      <dl className="grid gap-3 sm:grid-cols-2">
        {APPLICANT_ROWS_WITHOUT_PHONE.map((r) => {
          const isMissing = !APPLY_STEP3_VALIDATION_DISABLED && missing.includes(r.key);
          const wasOcr = prefilled.has(r.key);
          return (
            <div key={r.key}>
              <dt className="text-foreground flex flex-col gap-0.5 text-[11px] font-bold uppercase tracking-wide">
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
                  className={["rounded-xl", locked ? "cursor-not-allowed opacity-70" : ""].join(" ")}
                />
              </dd>
            </div>
          );
        })}
        <div key="phone">
          <dt className="text-foreground flex flex-col gap-0.5 text-[11px] font-bold uppercase tracking-wide">
            <span>Phone</span>
          </dt>
          <dd className="mt-1">
            <PhoneCountryField
              nationalities={nationalities}
              applicationNationalityCode={nationalityCode}
              storedPhone={values.phone ?? ""}
              disabled={locked}
              invalid={!APPLY_STEP3_VALIDATION_DISABLED && missing.includes("phone") && !values.phone}
              onChange={(e164) => setValues((prev) => ({ ...prev, phone: e164 }))}
            />
          </dd>
        </div>
      </dl>

      <div className="space-y-2 pt-2">
        <DoubleDecision
          className="max-w-md"
          dismissLabel="Previous"
          onDismiss={() =>
            router.push(`/apply/start?nationality=${encodeURIComponent(nationalityCode)}`)
          }
          confirmLabel={
            locked
              ? undefined
              : saving || extractPending
                ? extractPending
                  ? t("documents.readingPassport")
                  : t("draft.saving")
                : !dirty && canContinueToPayment
                  ? t("draft.continueToPayment")
                  : t("draft.next")
          }
          onConfirm={locked ? undefined : () => void onNext()}
          confirmDisabled={saving}
          confirmPending={saving || extractPending}
        />
        {!locked && saveMsg ? <p className="text-success text-xs">{saveMsg}</p> : null}
        {!locked && saveError ? <p className="text-error text-xs" role="alert">{saveError}</p> : null}
      </div>
      </div>
    </section>
  );
};
