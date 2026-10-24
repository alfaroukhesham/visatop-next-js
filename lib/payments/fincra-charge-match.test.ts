import { describe, expect, it } from "vitest";
import { matchFincraChargeToStoredPayment } from "./fincra-charge-match";

const payment = {
  id: "pay_1",
  amount: BigInt(18_500_000),
  currency: "NGN",
  providerOperationId: "pay_1",
};

describe("matchFincraChargeToStoredPayment", () => {
  it("matches when kobo amount, currency, and reference map to the stored payment", () => {
    expect(
      matchFincraChargeToStoredPayment({
        payment,
        merchantReference: "pay_1",
        reportedAmountMinor: BigInt(18_500_000),
        reportedCurrency: "ngn",
      }),
    ).toEqual({ kind: "match", amountMinor: BigInt(18_500_000), currency: "NGN" });
  });

  it("rejects an amount mismatch and does not treat it as a match", () => {
    expect(
      matchFincraChargeToStoredPayment({
        payment,
        merchantReference: "pay_1",
        reportedAmountMinor: BigInt(18_499_999),
        reportedCurrency: "NGN",
      }),
    ).toMatchObject({ kind: "mismatch", reason: "amount_mismatch", reportedMinor: BigInt(18_499_999) });

    expect(
      matchFincraChargeToStoredPayment({
        payment,
        merchantReference: "pay_1",
        reportedAmountMinor: BigInt(18_600_000),
        reportedCurrency: "NGN",
      }),
    ).toMatchObject({ kind: "mismatch", reason: "amount_mismatch" });
  });

  it("rejects a currency mismatch even when the minor amount is identical", () => {
    expect(
      matchFincraChargeToStoredPayment({
        payment,
        merchantReference: "pay_1",
        reportedAmountMinor: BigInt(18_500_000),
        reportedCurrency: "USD",
      }),
    ).toMatchObject({ kind: "mismatch", reason: "currency_mismatch", reportedCurrency: "USD" });
  });

  it("rejects an unknown or unbound merchant reference", () => {
    expect(
      matchFincraChargeToStoredPayment({
        payment: null,
        merchantReference: "pay_unknown",
        reportedAmountMinor: BigInt(18_500_000),
        reportedCurrency: "NGN",
      }),
    ).toEqual({ kind: "unknown_reference" });

    expect(
      matchFincraChargeToStoredPayment({
        payment,
        merchantReference: "someone-elses-ref",
        reportedAmountMinor: BigInt(18_500_000),
        reportedCurrency: "NGN",
      }),
    ).toEqual({ kind: "unknown_reference" });
  });
});
