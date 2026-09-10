import type { ApplicationStatus, FulfillmentStatus, PaymentStatus } from "@/lib/applications/status";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

export type ClientTrackingStepState = "done" | "current" | "upcoming";

export type ClientApplicationTracking = {
  headline: string;
  detail: string;
  steps: { key: string; label: string; state: ClientTrackingStepState }[];
};

export type ClientTrackingSource = {
  applicationStatus: ApplicationStatus | string;
  paymentStatus: PaymentStatus | string;
  fulfillmentStatus: FulfillmentStatus | string;
  adminAttentionRequired: boolean;
};

type TTranslate = (key: string) => string;

const defaultT = createCustomerT("en");

const PRE_PAY_STATUSES = new Set<string>([
  "draft",
  "needs_docs",
  "extracting",
  "needs_review",
  "ready_for_payment",
]);

const TERMINAL_STATUSES = new Set<string>([
  "cancelled",
  "rejection_by_uae_authorities",
  "completed",
]);

const STEP_KEYS = ["prepare", "payment", "processing", "outcome"] as const;

const TERMINAL_MESSAGE_KEYS: Record<string, { headline: string; detail: string }> = {
  cancelled: {
    headline: "track.tracking.cancelledHeadline",
    detail: "track.tracking.cancelledDetail",
  },
  rejection_by_uae_authorities: {
    headline: "track.tracking.rejectionHeadline",
    detail: "track.tracking.rejectionDetail",
  },
  completed: {
    headline: "track.tracking.completedHeadline",
    detail: "track.tracking.completedDetail",
  },
};

const OUTCOME_LABEL_KEY_BY_TERMINAL: Record<string, string> = {
  completed: "track.tracking.steps.complete",
  rejection_by_uae_authorities: "track.tracking.steps.decision",
  cancelled: "track.tracking.steps.closed",
};

const pickI18nDetail = (
  t: TTranslate,
  prefix: string,
  status: string,
  defaultKey: string,
): string => {
  const specificKey = `${prefix}.${status}`;
  const specific = t(specificKey);
  if (specific !== specificKey) return specific;
  return t(defaultKey);
};

function isPaid(paymentStatus: string) {
  return paymentStatus === "paid";
}

function isTerminalApplication(applicationStatus: string): boolean {
  return TERMINAL_STATUSES.has(applicationStatus);
}

function prePayDetail(t: TTranslate, status: string): string {
  return pickI18nDetail(
    t,
    "track.tracking.prePayDetails",
    status,
    "track.tracking.prePayDetails.default",
  );
}

function postPaymentFulfillmentDetail(t: TTranslate, fulfillmentStatus: string): string {
  return pickI18nDetail(
    t,
    "track.tracking.fulfillmentDetails",
    fulfillmentStatus,
    "track.tracking.fulfillmentDetails.default",
  );
}

type TrackingCtx = {
  applicationStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  paid: boolean;
  confirming: boolean;
  terminal: boolean;
  prePay: boolean;
};

function resolveMessage(t: TTranslate, ctx: TrackingCtx): { headline: string; detail: string } {
  if (ctx.terminal) {
    const keys = TERMINAL_MESSAGE_KEYS[ctx.applicationStatus];
    if (keys) {
      return { headline: t(keys.headline), detail: t(keys.detail) };
    }
  }
  if (ctx.confirming) {
    return {
      headline: t("track.tracking.confirmingPaymentHeadline"),
      detail: t("track.tracking.confirmingPaymentDetail"),
    };
  }
  if (!ctx.paid && ctx.paymentStatus === "failed") {
    return {
      headline: t("track.tracking.paymentFailedHeadline"),
      detail: t("track.tracking.paymentFailedDetail"),
    };
  }
  if (!ctx.paid && ctx.prePay) {
    return {
      headline: t("track.tracking.continueApplicationHeadline"),
      detail: prePayDetail(t, ctx.applicationStatus),
    };
  }
  if (ctx.paid && !ctx.terminal) {
    return {
      headline: t("track.tracking.workingOnApplicationHeadline"),
      detail: postPaymentFulfillmentDetail(t, ctx.fulfillmentStatus),
    };
  }
  if (!ctx.paid && ctx.applicationStatus === "in_progress") {
    return {
      headline: t("track.tracking.continueApplicationHeadline"),
      detail: prePayDetail(t, "ready_for_payment"),
    };
  }
  return {
    headline: t("track.tracking.genericHeadline"),
    detail: t("track.tracking.genericDetail"),
  };
}

/** Which step (0–3) is the active “current” step in the linear tracker. */
function currentStepIndex(ctx: TrackingCtx): 0 | 1 | 2 | 3 {
  if (ctx.terminal) return 3;
  if (!ctx.paid) {
    if (
      ctx.confirming ||
      ctx.paymentStatus === "failed" ||
      ctx.applicationStatus === "ready_for_payment"
    ) {
      return 1;
    }
    if (PRE_PAY_STATUSES.has(ctx.applicationStatus)) return 0;
    return 1;
  }
  return 2;
}

function buildSteps(
  t: TTranslate,
  currentIdx: 0 | 1 | 2 | 3,
  ctx: Pick<TrackingCtx, "confirming" | "terminal" | "applicationStatus">,
): ClientApplicationTracking["steps"] {
  return STEP_KEYS.map((key, i) => {
    const state: ClientTrackingStepState =
      i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming";
    let label = t(`track.tracking.steps.${key}`);
    if (key === "payment" && ctx.confirming) {
      label = t("track.tracking.steps.confirmPayment");
    }
    if (key === "outcome" && ctx.terminal) {
      label =
        t(OUTCOME_LABEL_KEY_BY_TERMINAL[ctx.applicationStatus] ?? "track.tracking.steps.outcome");
    }
    return { key, label, state };
  });
}

/**
 * Maps internal lifecycle fields to neutral client copy (no ops/automation jargon).
 */
export function computeClientApplicationTracking(
  src: ClientTrackingSource,
  t: TTranslate = defaultT,
): ClientApplicationTracking {
  const applicationStatus = String(src.applicationStatus);
  const paymentStatus = String(src.paymentStatus);
  const fulfillmentStatus = String(src.fulfillmentStatus);
  const { adminAttentionRequired } = src;

  const paid = isPaid(paymentStatus);
  const confirming = paymentStatus === "checkout_created";
  const terminal = isTerminalApplication(applicationStatus);
  const prePay = PRE_PAY_STATUSES.has(applicationStatus) && !paid;

  const ctx: TrackingCtx = {
    applicationStatus,
    paymentStatus,
    fulfillmentStatus,
    paid,
    confirming,
    terminal,
    prePay,
  };

  const { headline, detail: baseDetail } = resolveMessage(t, ctx);
  let detail = baseDetail;
  if (adminAttentionRequired && !terminal) {
    detail = `${detail} ${t("track.tracking.adminAttentionSuffix")}`.trim();
  }

  const stepIdx = currentStepIndex(ctx);
  const steps = buildSteps(t, stepIdx, {
    confirming,
    terminal,
    applicationStatus,
  });

  return { headline, detail, steps };
}
