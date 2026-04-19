/** Spec §14 — event names + failure reason buckets. */

export const GUEST_LINK_EVENTS = {
  submittedView: "submitted_view",
  guestLinkIntentPrepared: "guest_link_intent_prepared",
  authCallbackLand: "auth_callback_land",
  linkAfterAuthSuccess: "link_after_auth_success",
  linkAfterAuthFail: "link_after_auth_fail",
} as const;

export type LinkAfterAuthFailReason =
  | "intent_invalid"
  | "intent_resume_mismatch"
  | "resume_required"
  | "not_paid"
  | "cancelled"
  | "refund_state"
  | "not_found"
  | "already_owned_other"
  | "invalid_origin"
  /** `LINK_NOT_ALLOWED` without a finer server `details` subcode (matrix, other owner, lost race). */
  | "link_policy_denied"
  | "unknown";

export function mapLinkFailureDetailsCodeToReason(code: string | undefined): LinkAfterAuthFailReason {
  switch (code) {
    case "GUEST_LINK_INTENT_INVALID":
      return "intent_invalid";
    case "LINK_INTENT_RESUME_MISMATCH":
      return "intent_resume_mismatch";
    case "LINK_RESUME_REQUIRED":
      return "resume_required";
    case "INTENT_REQUIRES_PAID":
      return "not_paid";
    case "INVALID_ORIGIN":
      return "invalid_origin";
    case "LINK_NOT_ALLOWED":
      return "link_policy_denied";
    default:
      return "unknown";
  }
}

export function trackGuestLinkEvent(
  event: (typeof GUEST_LINK_EVENTS)[keyof typeof GUEST_LINK_EVENTS],
  detail?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("visatop:analytics", { detail: { event, ...detail } }));
}
