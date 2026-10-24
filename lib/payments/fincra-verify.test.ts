import { describe, expect, it } from "vitest";
import { decideFincraVerifiedPayment } from "./fincra-verify";
import type { FincraVerifiedPayment } from "./fincra-client";

const payment = {
  id: "pay_1",
  amount: BigInt(18500000),
  currency: "NGN",
  providerOperationId: "pay_1",
};

const base = (over: Partial<FincraVerifiedPayment>): FincraVerifiedPayment => ({
  id: "1",
  status: "success",
  currency: "NGN",
  amountMinor: BigInt(18500000),
  amountReceivedMinor: BigInt(18500000),
  amountExpectedMinor: BigInt(18500000),
  varianceType: null,
  message: null,
  merchantReference: "pay_1",
  reference: "fcr-p-abc",
  feeMinor: BigInt(301),
  raw: {},
  ...over,
});

describe("decideFincraVerifiedPayment", () => {
  it("marks exact success as paid only when amount and currency match the stored payment", () => {
    const d = decideFincraVerifiedPayment({ verified: base({}), payment });
    expect(d).toMatchObject({ kind: "paid", varianceType: "exact" });
  });

  it("does not mark paid on an overpayment amount mismatch", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ amountReceivedMinor: BigInt(18600000), varianceType: "overpayment" }),
      payment,
    });
    expect(d).toMatchObject({ kind: "mismatch", reason: "amount_mismatch" });
  });

  it("does not mark paid on an underpayment amount mismatch", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({
        amountReceivedMinor: BigInt(7300),
        varianceType: "underpayment",
        message: "INCORRECT_AMOUNT",
      }),
      payment,
    });
    expect(d).toMatchObject({ kind: "mismatch", reason: "amount_mismatch" });
  });

  it("does not mark paid when amountReceived is short of the locked quote", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ amountReceivedMinor: BigInt(18499999), varianceType: null }),
      payment,
    });
    expect(d).toMatchObject({ kind: "mismatch", reason: "amount_mismatch" });
  });

  it("does not mark paid on currency mismatch", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ currency: "USD" }),
      payment,
    });
    expect(d).toMatchObject({ kind: "mismatch", reason: "currency_mismatch" });
  });

  it("does not mark paid for an unknown reference", () => {
    expect(decideFincraVerifiedPayment({ verified: base({}), payment: null })).toEqual({
      kind: "unknown_reference",
    });
    expect(
      decideFincraVerifiedPayment({
        verified: base({ merchantReference: "other" }),
        payment,
        merchantReference: "other",
      }),
    ).toEqual({ kind: "unknown_reference" });
  });

  it("treats non-success as pending without recording a mismatch", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ status: "pending" }),
      payment,
    });
    expect(d.kind).toBe("pending");
  });
});
