export const TRANSACTIONAL_EMAIL_KINDS = {
  PAYMENT_RECEIVED_IN_PROGRESS: "payment_received_in_progress",
  OUTCOME_APPROVED: "outcome_approved",
  OUTCOME_UAE_AUTHORITY_REJECTION: "outcome_uae_authority_rejection",
} as const;

export type TransactionalEmailKind =
  (typeof TRANSACTIONAL_EMAIL_KINDS)[keyof typeof TRANSACTIONAL_EMAIL_KINDS];
