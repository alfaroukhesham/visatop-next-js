/** Customer apply funnel event names for GA4. */
export const APPLY_FUNNEL_EVENTS = {
  applicationStarted: "application_started",
  eligibilityCompleted: "eligibility_completed",
  visaListViewed: "visa_list_viewed",
  visaSelected: "visa_selected",
  applicationLinkSaved: "application_link_saved",
  passportUploaded: "passport_uploaded",
  photoUploaded: "photo_uploaded",
  ocrReviewRequired: "ocr_review_required",
  applicantVerified: "applicant_verified",
  checkoutViewed: "checkout_viewed",
  paymentStarted: "apply_payment_started",
  paymentSucceeded: "payment_succeeded",
  /** GA4 recommended event — auto key event, easiest Google Ads import. */
  purchase: "purchase",
  stepView: "apply_step_view",
} as const;

export type TGa4PurchaseParams = {
  transaction_id: string;
  value: number;
  currency: string;
};

export const buildGa4PurchaseParams = (input: {
  transactionId: string;
  value?: number;
  currency?: string;
}): TGa4PurchaseParams | null => {
  const transactionId = input.transactionId.trim();
  const currency = input.currency?.trim().toUpperCase() ?? "";
  if (!transactionId || !currency) return null;
  if (input.value === undefined || !Number.isFinite(input.value) || input.value < 0) {
    return null;
  }
  return {
    transaction_id: transactionId,
    value: input.value,
    currency,
  };
};

export type ApplyFunnelStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<ApplyFunnelStep, string> = {
  1: "nationality",
  2: "currency_visa",
  3: "documents",
  4: "payment",
  5: "status",
};

export const applyStepLabel = (step: ApplyFunnelStep): string => STEP_LABELS[step];

/**
 * Map a Next.js pathname (with or without `/visa-processing` basePath) to a funnel step.
 */
export const applyStepFromPathname = (pathname: string): ApplyFunnelStep | null => {
  const p = pathname.replace(/\/$/, "") || "/";
  const withoutBase = p.replace(/^\/visa-processing(?=\/|$)/, "") || "/";

  if (withoutBase === "/" || withoutBase === "") return 1;
  if (withoutBase.startsWith("/apply/start")) return 2;
  if (/^\/apply\/applications\/[^/]+\/payment(?:\/|$)/.test(withoutBase)) return 4;
  if (/^\/apply\/applications\/[^/]+\/submitted(?:\/|$)/.test(withoutBase)) return 5;
  if (/^\/apply\/applications\/[^/]+\/checkout(?:\/|$)/.test(withoutBase)) return null;
  if (/^\/apply\/applications\/[^/]+(?:\/|$)/.test(withoutBase)) return 3;
  return null;
};
