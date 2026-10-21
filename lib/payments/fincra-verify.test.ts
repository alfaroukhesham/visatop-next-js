import { describe, expect, it } from "vitest";
import { decideFincraVerifiedPayment } from "./fincra-verify";
import type { FincraVerifiedPayment } from "./fincra-client";

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
  const expected = { expectedMinor: BigInt(18500000), expectedCurrency: "NGN" };

  it("marks exact success as paid", () => {
    const d = decideFincraVerifiedPayment({ verified: base({}), ...expected });
    expect(d).toMatchObject({ kind: "paid", varianceType: "exact" });
  });

  it("marks overpayment as paid with overpayment variance", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ amountReceivedMinor: BigInt(18600000), varianceType: "overpayment" }),
      ...expected,
    });
    expect(d.kind).toBe("paid");
    if (d.kind === "paid") expect(d.varianceType).toBe("overpayment");
  });

  it("never auto-pays underpayments (varianceType)", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({
        amountReceivedMinor: BigInt(7300),
        varianceType: "underpayment",
        message: "INCORRECT_AMOUNT",
      }),
      ...expected,
    });
    expect(d.kind).toBe("underpaid");
  });

  it("never auto-pays when amountReceived is short of the locked quote", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ amountReceivedMinor: BigInt(18499999), varianceType: null }),
      ...expected,
    });
    expect(d.kind).toBe("underpaid");
  });

  it("rejects currency mismatch", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ currency: "USD" }),
      ...expected,
    });
    expect(d).toEqual({ kind: "rejected", reason: "currency_mismatch" });
  });

  it("treats non-success as pending", () => {
    const d = decideFincraVerifiedPayment({
      verified: base({ status: "pending" }),
      ...expected,
    });
    expect(d.kind).toBe("pending");
  });
});
