import type { PublicApplication } from "@/lib/applications/public-application";
import type { Readiness } from "@/lib/documents/validation-readiness";

export type ApplicantProfile = PublicApplication["applicant"];

/** Row keys for the applicant form; `"email"` maps to `application.guestEmail` on the server. */
export type ApplicantProfileFieldKey = keyof ApplicantProfile | "email";

export type PublicDocument = {
  id: string;
  documentType: string | null;
  status: string | null;
  contentType: string | null;
  byteLength: number | null;
  originalFilename: string | null;
  sha256: string | null;
  createdAt: string;
};

export type ExtractResponse = {
  extraction: {
    status: "succeeded" | "needs_manual" | "failed" | string;
    attemptsUsed: number;
    documentId: string | null;
    prefill: Partial<ApplicantProfile> & {
      dateOfBirth?: string | null;
      passportExpiryDate?: string | null;
    };
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

export type DocType = "passport_copy" | "personal_photo" | "supporting";

export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export const MIME_BY_TYPE: Record<DocType, string> = {
  passport_copy: "image/jpeg,image/png,application/pdf",
  personal_photo: "image/jpeg,image/png",
  supporting: "image/jpeg,image/png,application/pdf",
};

export const DATE_API_KEYS = new Set(["dateOfBirth", "passportExpiryDate"]);
