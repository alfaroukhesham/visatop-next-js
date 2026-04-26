import type { ApplicationStatus, FulfillmentStatus, PaymentStatus } from "@/lib/applications/status";

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

const PRE_PAY_STATUSES = new Set<string>([
  "draft",
  "needs_docs",
  "extracting",
  "needs_review",
  "ready_for_payment",
]);

const TERMINAL_MESSAGES = {
  cancelled: {
    headline: "Application cancelled",
    detail: "This application is closed. If you think this is a mistake, contact support.",
  },
  rejection_by_uae_authorities: {
    headline: "Application outcome",
    detail:
      "The issuing authority did not approve this application. If you have questions about the decision, use the help centre.",
  },
  completed: {
    headline: "Application complete",
    detail: "Thank you for applying with us. Keep your reference handy for your records.",
  },
} as const satisfies Record<string, { headline: string; detail: string }>;

const PRE_PAY_DETAIL_BY_STATUS: Record<string, string> = {
  draft: "Upload your passport and photo, then complete your details.",
  needs_docs: "We still need one or more documents before you can continue.",
  extracting: "We're reading your passport. This usually takes a minute.",
  needs_review: "Review the details we filled in and fix anything that looks off.",
  ready_for_payment: "Everything we need so far is in place. You can pay securely when you're ready.",
};

const DEFAULT_PRE_PAY_DETAIL = "Continue where you left off.";

const FULFILLMENT_DETAIL_BY_STATUS: Record<string, string> = {
  not_started: "We're preparing the next steps for your application.",
  automation_running: "Your application is being processed.",
  manual_in_progress: "Your application is being processed.",
  ready_for_ops_payment: "There is a follow-up step with our team before we can continue.",
  submitted: "Your application is with the issuing authority. Decisions can take some time.",
  done: "We've finished processing on our side.",
};

const DEFAULT_FULFILLMENT_DETAIL = "We're updating your application.";

const MESSAGES = {
  confirmingPayment: {
    headline: "Confirming payment",
    detail:
      "We're confirming your payment with our payment partner. This usually finishes within a few minutes.",
  },
  paymentFailed: {
    headline: "Payment did not go through",
    detail: "You can return to checkout and try again, or use a different payment method.",
  },
  continueApplication: {
    headline: "Continue your application",
    detail: "", // filled from PRE_PAY_DETAIL_BY_STATUS
  },
  workingOnApplication: {
    headline: "We're working on your application",
    detail: "", // filled from fulfillment map
  },
  generic: {
    headline: "Application status",
    detail: "We're processing updates. Check back shortly or refresh the page.",
  },
} as const;

const STEP_KEYS = ["prepare", "payment", "processing", "outcome"] as const;

const DEFAULT_STEP_LABELS: Record<(typeof STEP_KEYS)[number], string> = {
  prepare: "Prepare application",
  payment: "Payment",
  processing: "Processing",
  outcome: "Outcome",
};

const OUTCOME_LABEL_BY_TERMINAL: Record<string, string> = {
  completed: "Complete",
  rejection_by_uae_authorities: "Decision",
  cancelled: "Closed",
};

function isPaid(paymentStatus: string) {
  return paymentStatus === "paid";
}

function isTerminalApplication(applicationStatus: string): applicationStatus is keyof typeof TERMINAL_MESSAGES {
  return applicationStatus in TERMINAL_MESSAGES;
}

function pickDetail<T extends Record<string, string>>(map: T, key: string, fallback: string): string {
  return map[key] ?? fallback;
}

function postPaymentFulfillmentDetail(fulfillmentStatus: string): string {
  return pickDetail(FULFILLMENT_DETAIL_BY_STATUS, fulfillmentStatus, DEFAULT_FULFILLMENT_DETAIL);
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

function resolveMessage(ctx: TrackingCtx): { headline: string; detail: string } {
  if (ctx.terminal) {
    return TERMINAL_MESSAGES[ctx.applicationStatus as keyof typeof TERMINAL_MESSAGES];
  }
  if (ctx.confirming) {
    return { ...MESSAGES.confirmingPayment };
  }
  if (!ctx.paid && ctx.paymentStatus === "failed") {
    return { ...MESSAGES.paymentFailed };
  }
  if (!ctx.paid && ctx.prePay) {
    return {
      headline: MESSAGES.continueApplication.headline,
      detail: pickDetail(PRE_PAY_DETAIL_BY_STATUS, ctx.applicationStatus, DEFAULT_PRE_PAY_DETAIL),
    };
  }
  if (ctx.paid && !ctx.terminal) {
    return {
      headline: MESSAGES.workingOnApplication.headline,
      detail: postPaymentFulfillmentDetail(ctx.fulfillmentStatus),
    };
  }
  if (!ctx.paid && ctx.applicationStatus === "in_progress") {
    return {
      headline: MESSAGES.continueApplication.headline,
      detail: PRE_PAY_DETAIL_BY_STATUS.ready_for_payment,
    };
  }
  return { ...MESSAGES.generic };
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
  currentIdx: 0 | 1 | 2 | 3,
  ctx: Pick<TrackingCtx, "confirming" | "terminal" | "applicationStatus">,
): ClientApplicationTracking["steps"] {
  return STEP_KEYS.map((key, i) => {
    const state: ClientTrackingStepState =
      i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming";
    let label = DEFAULT_STEP_LABELS[key];
    if (key === "payment" && ctx.confirming) {
      label = "Confirm payment";
    }
    if (key === "outcome" && ctx.terminal) {
      label = OUTCOME_LABEL_BY_TERMINAL[ctx.applicationStatus] ?? DEFAULT_STEP_LABELS.outcome;
    }
    return { key, label, state };
  });
}

/**
 * Maps internal lifecycle fields to neutral client copy (no ops/automation jargon).
 */
export function computeClientApplicationTracking(src: ClientTrackingSource): ClientApplicationTracking {
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

  const { headline, detail: baseDetail } = resolveMessage(ctx);
  let detail = baseDetail;
  if (adminAttentionRequired && !terminal) {
    detail = `${detail} Our team may reach out if we need anything else from you.`.trim();
  }

  const stepIdx = currentStepIndex(ctx);
  const steps = buildSteps(stepIdx, {
    confirming,
    terminal,
    applicationStatus,
  });

  return { headline, detail, steps };
}
