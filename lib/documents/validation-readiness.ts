import { APPLY_STEP3_VALIDATION_DISABLED } from "@/lib/apply/apply-flow-config";

/**
 * Pure validation + readiness calculator (spec §6.5, §7.x).
 *
 * - Uses UTC dates only.
 * - 180-day passport-validity rule (spec §7.1).
 * - DOB sanity 1900-01-01 ≤ dob ≤ today (spec §7.2).
 * - Readiness precedence: `validationFailures` dominates `requiredFieldsMissing`
 *   (spec §6.5); missing uploads contribute to **case** `readiness` only.
 * - **`paymentReadiness`:** same precedence for profile fields and validation,
 *   but **passport_copy / personal_photo presence is not required** for `ready`
 *   (checkout gate). **Full `readiness`** still requires both uploads when
 *   profile + validation are satisfied (case-complete / submission-oriented).
 */

export const VALIDATION_SCHEMA_VERSION = 1 as const;

export const PASSPORT_MIN_VALIDITY_DAYS = 180;

export const SUBMISSION_REQUIRED_FIELDS = [
  "email",
  "phone",
  "fullName",
  "dateOfBirth",
  "placeOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiryDate",
  "profession",
  "address",
] as const;

export type SubmissionRequiredField = (typeof SUBMISSION_REQUIRED_FIELDS)[number];

export type Readiness =
  | "blocked_missing_required_fields"
  | "blocked_validation"
  | "ready";

export type ValidationFailure = {
  code:
    | "passport_expiry_date_invalid"
    | "dob_invalid";
  message: string;
};

export type ValidationResult = {
  schemaVersion: typeof VALIDATION_SCHEMA_VERSION;
  nowUtcDate: string;
  /** Profile + validation + both uploads; submission / case-complete gate. */
  readiness: Readiness;
  /** Profile + validation only; ignores upload booleans (payment / checkout gate). */
  paymentReadiness: Readiness;
  requiredFieldsMissing: SubmissionRequiredField[];
  validationFailures: ValidationFailure[];
};

export type ApplicantProfile = {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  nationality?: string | null;
  passportNumber?: string | null;
  passportExpiryDate?: string | null;
  profession?: string | null;
  address?: string | null;
};

export type UploadPresence = {
  passportCopyPresent: boolean;
  personalPhotoPresent: boolean;
};

/** `YYYY-MM-DD` in UTC. */
export function toUtcDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse `YYYY-MM-DD` in UTC; returns null on any format anomaly. */
export function parseIsoDateUtc(s: string | null | undefined): Date | null {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

/** Convert stored ISO calendar date `YYYY-MM-DD` to UK-style display `DD-MM-YYYY`. */
export function formatIsoDateAsDdMmYyyy(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "";
  const d = parseIsoDateUtc(iso.trim());
  if (!d) return iso.trim();
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Parse applicant date field input (DoB or passport expiry) to ISO `YYYY-MM-DD` for the API.
 * Accepts `DD-MM-YYYY` (primary) or legacy `YYYY-MM-DD` pasted values.
 */
export function parseDobInputToIsoUtc(s: string | null | undefined): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  if (t === "") return null;
  const isoCandidate = parseIsoDateUtc(t);
  if (isoCandidate) return toUtcDateString(isoCandidate);
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(t);
  if (!m) return null;
  const dd = Number(m[1]);
  const mo = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
  const date = new Date(Date.UTC(yyyy, mo - 1, dd));
  if (
    date.getUTCFullYear() !== yyyy ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== dd
  ) {
    return null;
  }
  return toUtcDateString(date);
}

function isPresent(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

export type ComputeValidationInput = {
  profile: ApplicantProfile;
  uploads: UploadPresence;
  now: Date;
};

export function computeValidation(input: ComputeValidationInput): ValidationResult {
  const now = input.now;
  const nowUtcDate = toUtcDateString(now);

  if (APPLY_STEP3_VALIDATION_DISABLED) {
    const hasEmail = isPresent(input.profile.email);
    return {
      schemaVersion: VALIDATION_SCHEMA_VERSION,
      nowUtcDate,
      readiness: hasEmail ? "ready" : "blocked_missing_required_fields",
      paymentReadiness: hasEmail ? "ready" : "blocked_missing_required_fields",
      requiredFieldsMissing: hasEmail ? [] : (["email"] as SubmissionRequiredField[]),
      validationFailures: [],
    };
  }

  const requiredFieldsMissing: SubmissionRequiredField[] = SUBMISSION_REQUIRED_FIELDS.filter(
    (key) => !isPresent(input.profile[key as keyof ApplicantProfile]),
  );

  const validationFailures: ValidationFailure[] = [];

  const passportExpiryRaw = input.profile.passportExpiryDate ?? null;
  const expiry = parseIsoDateUtc(passportExpiryRaw);
  if (isPresent(passportExpiryRaw) && !expiry) {
    validationFailures.push({
      code: "passport_expiry_date_invalid",
      message: "Passport expiry date looks invalid. Please check and correct it.",
    });
  }

  const dob = parseIsoDateUtc(input.profile.dateOfBirth ?? null);
  if (input.profile.dateOfBirth && !dob) {
    validationFailures.push({
      code: "dob_invalid",
      message: "Date of birth looks invalid. Please check and correct it.",
    });
  } else if (dob) {
    const lowerBound = Date.UTC(1900, 0, 1);
    const upperBound = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    if (dob.getTime() < lowerBound || dob.getTime() > upperBound) {
      validationFailures.push({
        code: "dob_invalid",
        message: "Date of birth looks invalid. Please check and correct it.",
      });
    }
  }

  let readiness: Readiness;
  let paymentReadiness: Readiness;

  if (validationFailures.length > 0) {
    readiness = "blocked_validation";
    paymentReadiness = "blocked_validation";
  } else if (
    requiredFieldsMissing.length > 0 ||
    !input.uploads.passportCopyPresent ||
    !input.uploads.personalPhotoPresent
  ) {
    readiness = "blocked_missing_required_fields";
    paymentReadiness =
      requiredFieldsMissing.length > 0 ? "blocked_missing_required_fields" : "ready";
  } else {
    readiness = "ready";
    paymentReadiness = "ready";
  }

  return {
    schemaVersion: VALIDATION_SCHEMA_VERSION,
    nowUtcDate,
    readiness,
    paymentReadiness,
    requiredFieldsMissing,
    validationFailures,
  };
}
