import type { PublicApplication } from "@/lib/applications/public-application";
import { PASSPORT_ACCEPT_MIME, PHOTO_ACCEPT_MIME } from "@/lib/apply/document-slot-catalog";
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

export type DocType = "passport_copy" | "personal_photo" | "supporting" | "bank_statement_6m";

export { UPLOAD_MAX_BYTES } from "@/lib/documents/upload-limits";

export const MIME_BY_TYPE: Record<DocType, string> = {
  passport_copy: PASSPORT_ACCEPT_MIME,
  personal_photo: PHOTO_ACCEPT_MIME,
  supporting: "image/jpeg,image/png,application/pdf",
  bank_statement_6m: "image/jpeg,image/png,application/pdf",
};

export type TUploadSlotError = {
  code: string;
};

export const DATE_API_KEYS = new Set(["dateOfBirth", "passportExpiryDate"]);
