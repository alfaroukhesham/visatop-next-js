export const TRANSACTIONAL_EMAIL_KINDS = {
  PAYMENT_RECEIVED_IN_PROGRESS: "payment_received_in_progress",
  OUTCOME_APPROVED: "outcome_approved",
  OUTCOME_UAE_AUTHORITY_REJECTION: "outcome_uae_authority_rejection",
  ADMIN_STEP2_SERVICE_SELECTED: "admin_step2_service_selected",
  ADMIN_PAYMENT_COMPLETED: "admin_payment_completed",
  APPLICATION_DRAFT_STARTED: "application_draft_started",
} as const;

export type TransactionalEmailKind =
  (typeof TRANSACTIONAL_EMAIL_KINDS)[keyof typeof TRANSACTIONAL_EMAIL_KINDS];
