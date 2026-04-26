import type { ApplicationStatus } from "@/lib/applications/status";
import { ADMIN_WORKFLOW_APPLICATION_STATUSES, TERMINAL_APPLICATION_STATUSES } from "@/lib/applications/status";

const WORKFLOW: ApplicationStatus[] = ["in_progress", "awaiting_authority"];

export function isAdminWorkflowApplicationStatus(s: string): s is ApplicationStatus {
  return ADMIN_WORKFLOW_APPLICATION_STATUSES.has(s as ApplicationStatus);
}

export function assertPaidForOps(paymentStatus: string): void {
  if (paymentStatus !== "paid") {
    throw new Error("INVALID_OPS_STATE:payment_not_paid");
  }
}

/**
 * @throws Error with message INVALID_TRANSITION:... or INVALID_OPS_STATE:...
 */
export function assertApplicationStatusAdminTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): void {
  if (TERMINAL_APPLICATION_STATUSES.has(from)) {
    throw new Error("INVALID_TRANSITION:from_terminal");
  }

  if (from === to) return;

  if (WORKFLOW.includes(from) && WORKFLOW.includes(to)) {
    return;
  }

  if (WORKFLOW.includes(from) && to === "completed") return;
  if (WORKFLOW.includes(from) && to === "rejection_by_uae_authorities") return;
  if (WORKFLOW.includes(from) && to === "cancelled") return;

  throw new Error(`INVALID_TRANSITION:${from}_to_${to}`);
}
