export type TPaymentReviewNav = "need_passport" | "wait_extract" | "blocked" | "go";

export type TPaymentReviewNavInput = {
  passportUploaded: boolean;
  extractPending: boolean;
  paymentReady: boolean;
};

/** Documents-step Next: wait for in-flight passport OCR before the payment recap. */
export const paymentReviewNavState = (input: TPaymentReviewNavInput): TPaymentReviewNav => {
  if (!input.passportUploaded) return "need_passport";
  if (input.extractPending) return "wait_extract";
  if (!input.paymentReady) return "blocked";
  return "go";
};
