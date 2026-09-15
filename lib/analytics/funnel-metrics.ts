import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { FUNNEL_CHECKOUT_CREATED } from "@/lib/analytics/funnel-event-names";
import { GUEST_LINK_EVENTS } from "@/lib/analytics/guest-link-events";
import type { TBiggestDrop, TFunnelRow } from "@/lib/analytics/admin-analytics-types";

export type TFunnelEventRow = {
  eventName: string;
  sessionId: string;
  applicationId: string | null;
};

export type TFunnelStepDef = {
  eventName: string;
  label: string;
};

/** Linear conversion path used for drop-off (optional branches are extraSteps). */
export const ADMIN_FUNNEL_STEPS: TFunnelStepDef[] = [
  { eventName: APPLY_FUNNEL_EVENTS.applicationStarted, label: "Nationality / start" },
  { eventName: APPLY_FUNNEL_EVENTS.eligibilityCompleted, label: "Eligibility completed" },
  { eventName: APPLY_FUNNEL_EVENTS.visaListViewed, label: "Visa list viewed" },
  { eventName: APPLY_FUNNEL_EVENTS.visaSelected, label: "Visa selected / created" },
  { eventName: APPLY_FUNNEL_EVENTS.applicationLinkSaved, label: "Email / resume link saved" },
  { eventName: APPLY_FUNNEL_EVENTS.passportUploaded, label: "Passport uploaded" },
  { eventName: APPLY_FUNNEL_EVENTS.photoUploaded, label: "Personal photo uploaded" },
  { eventName: APPLY_FUNNEL_EVENTS.applicantVerified, label: "Applicant verified" },
  { eventName: APPLY_FUNNEL_EVENTS.checkoutViewed, label: "Checkout viewed" },
  { eventName: FUNNEL_CHECKOUT_CREATED, label: "Checkout created" },
  { eventName: APPLY_FUNNEL_EVENTS.paymentStarted, label: "Payment started" },
  { eventName: APPLY_FUNNEL_EVENTS.paymentSucceeded, label: "Paid" },
];

export const EXTRA_FUNNEL_STEPS: TFunnelStepDef[] = [
  { eventName: APPLY_FUNNEL_EVENTS.ocrReviewRequired, label: "OCR review required" },
  { eventName: APPLY_FUNNEL_EVENTS.stepView, label: "Apply step viewed" },
  { eventName: GUEST_LINK_EVENTS.submittedView, label: "Submitted page viewed" },
  { eventName: GUEST_LINK_EVENTS.guestLinkIntentPrepared, label: "Guest link intent prepared" },
  { eventName: GUEST_LINK_EVENTS.authCallbackLand, label: "Auth callback land" },
  { eventName: GUEST_LINK_EVENTS.linkAfterAuthSuccess, label: "Account linked after pay" },
  { eventName: GUEST_LINK_EVENTS.linkAfterAuthFail, label: "Account link failed" },
];

export const uniqueSubjectId = (row: {
  sessionId: string;
  applicationId: string | null;
}): string => row.applicationId ?? row.sessionId;

const pct = (part: number, whole: number): number | null => {
  if (whole <= 0) return null;
  return (part / whole) * 100;
};

const subjectForEvent = (event: TFunnelEventRow): string | null => {
  if (event.eventName === APPLY_FUNNEL_EVENTS.visaSelected && !event.applicationId) {
    return null;
  }
  return uniqueSubjectId(event);
};

export const buildFunnelRows = (events: TFunnelEventRow[]): TFunnelRow[] => {
  const subjectsByEvent = new Map<string, Set<string>>();
  for (const event of events) {
    const subject = subjectForEvent(event);
    if (!subject) continue;
    let set = subjectsByEvent.get(event.eventName);
    if (!set) {
      set = new Set();
      subjectsByEvent.set(event.eventName, set);
    }
    set.add(subject);
  }

  return ADMIN_FUNNEL_STEPS.map((step, index) => {
    const count = subjectsByEvent.get(step.eventName)?.size ?? 0;
    const prevCount = index === 0 ? null : (subjectsByEvent.get(ADMIN_FUNNEL_STEPS[index - 1]!.eventName)?.size ?? 0);
    const keepPct = prevCount === null ? null : pct(count, prevCount);
    const dropPct = keepPct === null ? null : prevCount === 0 ? null : 100 - keepPct;
    return {
      eventName: step.eventName,
      label: step.label,
      count,
      keepPct,
      dropPct,
    };
  });
};

export const extraStepCounts = (
  events: TFunnelEventRow[],
): { eventName: string; label: string; count: number }[] => {
  const subjectsByEvent = new Map<string, Set<string>>();
  for (const event of events) {
    const subject = subjectForEvent(event);
    if (!subject) continue;
    let set = subjectsByEvent.get(event.eventName);
    if (!set) {
      set = new Set();
      subjectsByEvent.set(event.eventName, set);
    }
    set.add(subject);
  }
  return EXTRA_FUNNEL_STEPS.map((step) => ({
    eventName: step.eventName,
    label: step.label,
    count: subjectsByEvent.get(step.eventName)?.size ?? 0,
  }));
};

export const biggestFunnelDrop = (funnel: TFunnelRow[]): TBiggestDrop | null => {
  const reached = funnel.filter((s) => s.count > 0);
  let best: TBiggestDrop | null = null;
  for (let i = 1; i < reached.length; i += 1) {
    const prev = reached[i - 1]!;
    const next = reached[i]!;
    if (next.count >= prev.count) continue;
    const dropPct = ((prev.count - next.count) / prev.count) * 100;
    if (!best || dropPct > best.dropPct) {
      best = {
        eventName: next.eventName,
        label: next.label,
        fromCount: prev.count,
        toCount: next.count,
        dropPct,
      };
    }
  }
  return best;
};

export const computeChurnTrio = (input: {
  created: number;
  paid: number;
  abandonedDrafts: number;
  funnel: TFunnelRow[];
}): {
  overallAbandonPct: number | null;
  biggestDrop: TBiggestDrop | null;
  abandonedDrafts: number;
} => {
  const overallAbandonPct =
    input.created <= 0 ? null : (1 - input.paid / input.created) * 100;
  return {
    overallAbandonPct,
    biggestDrop: biggestFunnelDrop(input.funnel),
    abandonedDrafts: input.abandonedDrafts,
  };
};
