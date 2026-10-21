import { describe, expect, it } from "vitest";
import {
  buildFincraInlineCheckoutData,
  FINCRA_INLINE_SCRIPT_SRC,
  toFincraInitializeOptions,
} from "./fincra-inline";

describe("Fincra inline checkout payload", () => {
  it("pins the documented checkout@2.2.0 script", () => {
    expect(FINCRA_INLINE_SCRIPT_SRC).toBe(
      "https://unpkg.com/@fincra-engineering/checkout@2.2.0/dist/inline.min.js",
    );
  });

  it("builds public inline fields from the stored kobo amount and never includes a secret key", () => {
    const data = buildFincraInlineCheckoutData({
      publicKey: "pk_test_public",
      amountMinor: BigInt(18_500_000),
      customer: { name: "Ada Lovelace", email: "ada@example.com", phoneNumber: "+2348012345678" },
      reference: "pay_1",
      feeBearer: "business",
      metadata: { applicationId: "app_1", paymentId: "pay_1" },
    });

    expect(data).toEqual({
      provider: "fincra",
      mode: "inline",
      key: "pk_test_public",
      amount: 185000,
      currency: "NGN",
      customer: { name: "Ada Lovelace", email: "ada@example.com", phoneNumber: "+2348012345678" },
      reference: "pay_1",
      feeBearer: "business",
      metadata: { applicationId: "app_1", paymentId: "pay_1" },
    });
    expect(JSON.stringify(data)).not.toMatch(/secret|sk_/i);
  });

  it("passes the server-computed values through to Fincra.initialize unchanged", () => {
    const data = buildFincraInlineCheckoutData({
      publicKey: "pk_live",
      amountMinor: BigInt(10000),
      customer: { name: "A", email: "a@b.c" },
      reference: "pay_9",
      feeBearer: "customer",
      metadata: { paymentId: "pay_9" },
    });
    const options = toFincraInitializeOptions(data, {
      onSuccess: () => undefined,
      onClose: () => undefined,
    });
    expect(options.key).toBe(data.key);
    expect(options.amount).toBe(data.amount);
    expect(options.currency).toBe("NGN");
    expect(options.reference).toBe("pay_9");
    expect(options.feeBearer).toBe("customer");
    expect(options.metadata).toEqual({ paymentId: "pay_9" });
    expect(options.customer).toEqual({ name: "A", email: "a@b.c" });
  });
});
