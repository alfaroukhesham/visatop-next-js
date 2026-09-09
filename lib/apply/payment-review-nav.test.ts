import { describe, expect, it } from "vitest";
import { paymentReviewNavState } from "./payment-review-nav";

describe("paymentReviewNavState", () => {
  it("requires a passport before payment review", () => {
    expect(
      paymentReviewNavState({
        passportUploaded: false,
        extractPending: false,
        paymentReady: true,
      }),
    ).toBe("need_passport");
  });

  it("waits when passport OCR is still running", () => {
    expect(
      paymentReviewNavState({
        passportUploaded: true,
        extractPending: true,
        paymentReady: true,
      }),
    ).toBe("wait_extract");
  });

  it("does not treat a completed extract as a wait even if payment is ready", () => {
    expect(
      paymentReviewNavState({
        passportUploaded: true,
        extractPending: false,
        paymentReady: true,
      }),
    ).toBe("go");
  });

  it("blocks when payment is not ready after extract", () => {
    expect(
      paymentReviewNavState({
        passportUploaded: true,
        extractPending: false,
        paymentReady: false,
      }),
    ).toBe("blocked");
  });
});
