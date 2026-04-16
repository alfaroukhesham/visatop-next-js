/**
 * Pure validation + readiness calculator (spec §6.5, §7.x).
 *
 * - Uses UTC dates only.
 * - 180-day passport-validity rule (spec §7.1).
 * - DOB sanity 1900-01-01 ≤ dob ≤ today (spec §7.2).
 * - Readiness precedence: `validationFailures` dominates `requiredFieldsMissing`
 *   (spec §6.5); missing uploads contribute to `requiredFieldsMissing`.
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
  code: "passport_expired_or_insufficient_validity" | "dob_invalid";
  message: string;
};

export type ValidationResult = {
  schemaVersion: typeof VALIDATION_SCHEMA_VERSION;
  nowUtcDate: string;
  readiness: Readiness;
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

function isPresent(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function addDaysUtc(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export type ComputeValidationInput = {
  profile: ApplicantProfile;
  uploads: UploadPresence;
  now: Date;
};

export function computeValidation(input: ComputeValidationInput): ValidationResult {
  const now = input.now;
  const nowUtcDate = toUtcDateString(now);

  const requiredFieldsMissing: SubmissionRequiredField[] = SUBMISSION_REQUIRED_FIELDS.filter(
    (key) => !isPresent(input.profile[key as keyof ApplicantProfile]),
  );

  const validationFailures: ValidationFailure[] = [];

  const expiry = parseIsoDateUtc(input.profile.passportExpiryDate ?? null);
  if (expiry) {
    const minValid = addDaysUtc(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      PASSPORT_MIN_VALIDITY_DAYS,
    );
    if (expiry.getTime() < minValid.getTime()) {
      validationFailures.push({
        code: "passport_expired_or_insufficient_validity",
        message: "Passport must be valid for at least 6 months.",
      });
    }
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

  // Required-document presence contributes to missing fields but under their
  // dedicated pseudo-keys; however the spec §6.5 lists explicit profile
  // keys — docs gating is surfaced by the `uploads` booleans already used by
  // the route layer. Keep validation payload focused on profile keys.

  let readiness: Readiness;
  if (validationFailures.length > 0) {
    readiness = "blocked_validation";
  } else if (
    requiredFieldsMissing.length > 0 ||
    !input.uploads.passportCopyPresent ||
    !input.uploads.personalPhotoPresent
  ) {
    readiness = "blocked_missing_required_fields";
  } else {
    readiness = "ready";
  }

  return {
    schemaVersion: VALIDATION_SCHEMA_VERSION,
    nowUtcDate,
    readiness,
    requiredFieldsMissing,
    validationFailures,
  };
}
