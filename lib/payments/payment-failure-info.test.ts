import { describe, expect, it, vi } from "vitest";
import {
  analyticsPaymentFailureKey,
  fincraFailureCodeFromEventName,
  recordPaymentFailureInfo,
  sanitizePaymentFailureCode,
  sanitizePaymentFailureMessage,
} from "./payment-failure-info";

describe("sanitizePaymentFailureCode", () => {
  it("normalizes provider codes", () => {
    expect(sanitizePaymentFailureCode("Expired")).toBe("expired");
    expect(sanitizePaymentFailureCode("card declined")).toBe("card_declined");
    expect(sanitizePaymentFailureCode("")).toBeNull();
  });
});

describe("sanitizePaymentFailureMessage", () => {
  it("keeps short provider copy and drops emails", () => {
    expect(sanitizePaymentFailureMessage(" Insufficient funds ")).toBe("Insufficient funds");
    expect(sanitizePaymentFailureMessage("declined for a@b.co")).toBeNull();
    expect(sanitizePaymentFailureMessage(12)).toBeNull();
  });
});

describe("fincraFailureCodeFromEventName", () => {
  it("maps terminal unpaid events only", () => {
    expect(fincraFailureCodeFromEventName("charge.expired")).toBe("expired");
    expect(fincraFailureCodeFromEventName("charge.failed")).toBe("failed");
    expect(fincraFailureCodeFromEventName("charge.successful")).toBeNull();
  });
});

describe("analyticsPaymentFailureKey", () => {
  it("prefixes the provider", () => {
    expect(analyticsPaymentFailureKey("fincra", "expired")).toBe("fincra:expired");
  });
});

describe("recordPaymentFailureInfo", () => {
  it("updates failure fields and skips paid rows via the where clause", async () => {
    const returning = vi.fn(async () => [{ id: "pay_1" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const tx = { update: vi.fn(() => ({ set })) };
    const wrote = await recordPaymentFailureInfo(tx as never, {
      paymentId: "pay_1",
      failureCode: "expired",
      failureMessage: "timeout",
    });
    expect(wrote).toBe(true);
    expect(set).toHaveBeenCalledWith({ failureCode: "expired", failureMessage: "timeout" });
    expect(set.mock.calls[0]![0]).not.toHaveProperty("status");
  });
});
