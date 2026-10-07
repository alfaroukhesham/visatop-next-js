/** Stable string unions used across app code. Safe for client bundles (no Drizzle). */
export const DOCUMENT_TYPE = {
  PASSPORT_COPY: "passport_copy",
  PERSONAL_PHOTO: "personal_photo",
  SUPPORTING: "supporting",
  BANK_STATEMENT_6M: "bank_statement_6m",
  /** Optional admin uploads while processing (non-terminal steps). */
  ADMIN_STEP_ATTACHMENT: "admin_step_attachment",
  /** Required when marking application completed (visa / approval pack). */
  OUTCOME_APPROVAL: "outcome_approval",
  /** Required when marking UAE authority rejection. */
  OUTCOME_AUTHORITY_REJECTION: "outcome_authority_rejection",
} as const;
export type DocumentType = (typeof DOCUMENT_TYPE)[keyof typeof DOCUMENT_TYPE];

export const DOCUMENT_STATUS = {
  UPLOADED_TEMP: "uploaded_temp",
  RETAINED: "retained",
  REJECTED: "rejected",
  DELETED: "deleted",
} as const;
export type DocumentStatus = (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

export const EXTRACTION_STATUS = {
  NOT_STARTED: "not_started",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  NEEDS_MANUAL: "needs_manual",
  BLOCKED_INVALID_DOC: "blocked_invalid_doc",
  FAILED: "failed",
} as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUS)[keyof typeof EXTRACTION_STATUS];

export const EXTRACTION_ATTEMPT_STATUS = {
  STARTED: "started",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
} as const;
export type ExtractionAttemptStatus =
  (typeof EXTRACTION_ATTEMPT_STATUS)[keyof typeof EXTRACTION_ATTEMPT_STATUS];
