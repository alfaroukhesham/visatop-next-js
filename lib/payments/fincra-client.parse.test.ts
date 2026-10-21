import { describe, expect, it } from "vitest";
import {
  FincraProviderError,
  parseFincraCheckoutCreated,
  parseFincraRefundResult,
  parseFincraVerifiedPayment,
} from "./fincra-client";

describe("parseFincraCheckoutCreated", () => {
  it("reads link and payCode", () => {
    const created = parseFincraCheckoutCreated({
      status: true,
      data: {
        link: "https://checkout.fincra.com/pay/fcr-p-abc",
        payCode: "fcr-p-abc",
      },
    });
    expect(created).toEqual({
      link: "https://checkout.fincra.com/pay/fcr-p-abc",
      payCode: "fcr-p-abc",
      reference: null,
    });
  });

  it("fails closed when link is missing", () => {
    expect(() => parseFincraCheckoutCreated({ status: true, data: { payCode: "x" } })).toThrow(
      FincraProviderError,
    );
  });
});

describe("parseFincraVerifiedPayment", () => {
  it("converts major units to kobo", () => {
    const v = parseFincraVerifiedPayment({
      status: true,
      data: {
        id: 1093510,
        amount: 185000,
        amountReceived: 185000.5,
        amountExpected: 185000,
        currency: "NGN",
        status: "success",
        reference: "fcr-p-abc",
        merchantReference: "pay_1",
        varianceType: null,
        fee: 3.01,
      },
    });
    expect(v.amountMinor).toBe(BigInt(18500000));
    expect(v.amountReceivedMinor).toBe(BigInt(18500050));
    expect(v.amountExpectedMinor).toBe(BigInt(18500000));
    expect(v.feeMinor).toBe(BigInt(301));
    expect(v.merchantReference).toBe("pay_1");
  });
});

describe("parseFincraRefundResult", () => {
  it("treats 422 already initiated as idempotent success", () => {
    const r = parseFincraRefundResult(
      { success: false, error: "Refund already initiated", errorType: "UNPROCESSABLE_ENTITY" },
      422,
    );
    expect(r.alreadyInitiated).toBe(true);
    expect(r.status).toBe("already_initiated");
  });

  it("reads a new refund reference", () => {
    const r = parseFincraRefundResult(
      {
        success: true,
        data: { reference: "ref-1", collectionVarianceType: "fixed" },
      },
      200,
    );
    expect(r).toEqual({ refundId: "ref-1", status: "initiated", alreadyInitiated: false });
  });
});
