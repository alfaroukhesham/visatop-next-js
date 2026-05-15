import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apply/apply-flow-config", () => ({
  APPLY_STEP3_VALIDATION_DISABLED: false,
}));

import { computeValidation } from "@/lib/documents/validation-readiness";
import { readinessPromotionAction } from "./evaluate-readiness";

const NOW = new Date(Date.UTC(2026, 3, 16));

function paymentOnlyReadyMissingUploads() {
  return computeValidation({
    profile: {
      email: "a@b.co",
      phone: "+1",
      fullName: "Ada",
      dateOfBirth: "1990-01-02",
      placeOfBirth: "London",
      nationality: "British",
      passportNumber: "X1",
      passportExpiryDate: "2099-01-01",
      profession: "Eng",
      address: "1 St",
    },
    uploads: { passportCopyPresent: true, personalPhotoPresent: false },
    now: NOW,
  });
}

describe("readinessPromotionAction", () => {
  it("advances from needs_review when paymentReadiness is ready (uploads may be incomplete)", () => {
    const v = paymentOnlyReadyMissingUploads();
    expect(v.readiness).toBe("blocked_missing_required_fields");
    expect(v.paymentReadiness).toBe("ready");
    expect(readinessPromotionAction("needs_review", v)).toBe("advance");
  });

  it("does not advance when paymentReadiness is not ready", () => {
    const v = computeValidation({
      profile: {
        email: "a@b.co",
        phone: "+1",
        fullName: "",
        dateOfBirth: "1990-01-02",
        placeOfBirth: "London",
        nationality: "British",
        passportNumber: "X1",
        passportExpiryDate: "2099-01-01",
        profession: "Eng",
        address: "1 St",
      },
      uploads: { passportCopyPresent: true, personalPhotoPresent: true },
      now: NOW,
    });
    expect(readinessPromotionAction("needs_review", v)).toBe("noop");
  });

  it("reverts ready_for_payment when paymentReadiness drops", () => {
    const v = computeValidation({
      profile: {
        email: "a@b.co",
        phone: "+1",
        fullName: "",
        dateOfBirth: "1990-01-02",
        placeOfBirth: "London",
        nationality: "British",
        passportNumber: "X1",
        passportExpiryDate: "2099-01-01",
        profession: "Eng",
        address: "1 St",
      },
      uploads: { passportCopyPresent: true, personalPhotoPresent: true },
      now: NOW,
    });
    expect(readinessPromotionAction("ready_for_payment", v)).toBe("revert");
  });

  it("is noop for non-evaluable application statuses", () => {
    const v = paymentOnlyReadyMissingUploads();
    expect(readinessPromotionAction("completed", v)).toBe("noop");
    expect(readinessPromotionAction("in_progress", v)).toBe("noop");
  });

  it("is noop when already ready_for_payment and payment still ready", () => {
    const v = computeValidation({
      profile: {
        email: "a@b.co",
        phone: "+1",
        fullName: "Ada",
        dateOfBirth: "1990-01-02",
        placeOfBirth: "London",
        nationality: "British",
        passportNumber: "X1",
        passportExpiryDate: "2099-01-01",
        profession: "Eng",
        address: "1 St",
      },
      uploads: { passportCopyPresent: true, personalPhotoPresent: true },
      now: NOW,
    });
    expect(readinessPromotionAction("ready_for_payment", v)).toBe("noop");
  });
});
