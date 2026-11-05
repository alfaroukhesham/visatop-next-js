import { describe, expect, it } from "vitest";
import { decideFincraVerifiedPayment, fincraAmountAuditFields, isFincraSuccessStatus } from "./fincra-verify";
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
  amountToSettleMinor: BigInt(18499699),
  varianceType: null,
  message: null,
  merchantReference: "pay_1",
  reference: "fcr-p-abc",
  feeMinor: BigInt(301),
  raw: {},
  ...over,
});

describe("decideFincraVerifiedPayment", () => {
  it("marks exact success as paid only when amountReceived matches the stored quote and varianceType is empty", () => {
    const d = decideFincraVerifiedPayment({ verified: base({}), payment });
    expect(d).toMatchObject({ kind: "paid", varianceType: "exact" });
  });

  it("accepts status successful the same as success", () => {
    const d = decideFincraVerifiedPayment({ verified: base({ status: "successful" }), payment });
    expect(d.kind).toBe("paid");
  });

  it("does not treat status success alone as paid", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ amountReceivedMinor: BigInt(100), varianceType: null }),
      payment,
    });
    expect(d.kind).toBe("mismatch");
  });

  it("falls back to amount when amountReceived is null", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ amountReceivedMinor: null, amountMinor: BigInt(18500000) }),
      payment,
    });
    expect(d.kind).toBe("paid");
  });

  it("does not match on amountToSettle", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({
        amountReceivedMinor: BigInt(18500000),
        amountToSettleMinor: BigInt(1),
        varianceType: null,
      }),
      payment,
    });
    expect(d.kind).toBe("paid");
  });

  it("holds an overpayment variance even when status is success", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ amountReceivedMinor: BigInt(18600000), varianceType: "overpayment" }),
      payment,
    });
    expect(d).toMatchObject({ kind: "mismatch", reason: "variance_overpayment" });
    expect(d.kind === "mismatch" && d.amountAudit.varianceType).toBe("overpayment");
  });

  it("holds an underpayment variance even when status is success", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({
        amountReceivedMinor: BigInt(7300),
        varianceType: "underpayment",
        message: "INCORRECT_AMOUNT",
      }),
      payment,
    });
    expect(d).toMatchObject({ kind: "mismatch", reason: "variance_underpayment" });
  });

  it("holds a non-empty unknown varianceType without marking paid", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ varianceType: "partial" }),
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

  it("marks paid when an older unpaid attempt succeeds for the same payment", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ merchantReference: "pay_1-a2" }),
      payment: { ...payment, providerOperationId: "pay_1-a3" },
      merchantReference: "pay_1-a2",
    });
    expect(d).toMatchObject({ kind: "paid", varianceType: "exact" });
  });

  it("treats a later attempt as extra collection once the payment is already paid", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ merchantReference: "pay_1-a2" }),
      payment: { ...payment, providerOperationId: "pay_1-a3", settledMerchantReference: "pay_1-a3" },
      merchantReference: "pay_1-a2",
      alreadyPaid: true,
      settledMerchantReference: "pay_1-a3",
    });
    expect(d).toMatchObject({ kind: "extra_collection", merchantReference: "pay_1-a2" });
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

  it("treats provider expired as expired so reconcile can release the lock", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ status: "expired" }),
      payment,
    });
    expect(d).toEqual({ kind: "expired", reason: "status:expired" });
  });

  it("treats provider failed as failed so the lock can be released after verify", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ status: "failed" }),
      payment,
    });
    expect(d).toEqual({ kind: "failed", reason: "status:failed" });
  });
});

describe("fincraAmountAuditFields", () => {
  it("logs only amount-related fields and never customer PII", () => {
    const fields = fincraAmountAuditFields(
      base({
        raw: { customer: { name: "Ada", email: "ada@mail.com", phoneNumber: "+234" } },
      }),
    );
    const serialized = JSON.stringify(fields);
    expect(fields).toEqual({
      amount: "18500000",
      amountReceived: "18500000",
      amountExpected: "18500000",
      amountToSettle: "18499699",
      fee: "301",
      varianceType: null,
      currency: "NGN",
      reference: "fcr-p-abc",
      merchantReference: "pay_1",
      status: "success",
    });
    expect(serialized).not.toMatch(/ada@mail|Ada|\+234|phone|email|name/i);
    expect(isFincraSuccessStatus("SUCCESS")).toBe(true);
    expect(isFincraSuccessStatus("successful")).toBe(true);
    expect(isFincraSuccessStatus("pending")).toBe(false);
  });
});
