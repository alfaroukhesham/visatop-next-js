import { describe, expect, it } from "vitest";
import {
  canAbandonFincraOpenPaymentAfterVerify,
  FINCRA_PROVIDER_EXPIRY_MS,
  summarizeFincraAttemptVerifications,
  type TFincraAttemptVerifyResult,
} from "./fincra-attempt-verify";
import type { FincraVerifiedPayment } from "./fincra-client";
import type { TFincraVerifyDecision } from "./fincra-verify";

const createdAt = new Date("2026-11-05T10:00:00.000Z");

const verified = (over: Partial<FincraVerifiedPayment> = {}): FincraVerifiedPayment => ({
  id: "1",
  status: "pending",
  currency: "NGN",
  amountMinor: BigInt(18500000),
  amountReceivedMinor: BigInt(18500000),
  amountExpectedMinor: BigInt(18500000),
  amountToSettleMinor: BigInt(18499699),
  varianceType: null,
  message: null,
  merchantReference: "pay_1-a1",
  reference: "fcr-p-abc",
  feeMinor: BigInt(301),
  raw: {},
  ...over,
});

const result = (
  merchantReference: string,
  decision: TFincraVerifyDecision,
  status = "success",
): TFincraAttemptVerifyResult => ({
  merchantReference,
  kind: "verified",
  verified: verified({ merchantReference, status }),
  decision,
});

describe("canAbandonFincraOpenPaymentAfterVerify", () => {
  it("does not abandon a pending bank transfer", () => {
    expect(
      canAbandonFincraOpenPaymentAfterVerify({
        results: [result("pay_1-a1", { kind: "pending", reason: "status:pending" }, "pending")],
        paymentCreatedAt: createdAt,
        nowMs: createdAt.getTime() + 20 * 60 * 1000,
      }),
    ).toBe(false);
  });

  it("does not abandon a mismatch hold", () => {
    expect(
      canAbandonFincraOpenPaymentAfterVerify({
        results: [
          result("pay_1-a1", {
            kind: "mismatch",
            reason: "variance_underpayment",
            amountReceivedMinor: BigInt(7300),
            expectedMinor: BigInt(18500000),
            expectedCurrency: "NGN",
            reportedCurrency: "NGN",
            feeMinor: null,
            amountAudit: {
              amount: "18500000",
              amountReceived: "7300",
              amountExpected: "18500000",
              amountToSettle: null,
              fee: null,
              varianceType: "underpayment",
              currency: "NGN",
              reference: "fcr-p-abc",
              merchantReference: "pay_1-a1",
              status: "success",
            },
          }),
        ],
        paymentCreatedAt: createdAt,
        nowMs: createdAt.getTime() + FINCRA_PROVIDER_EXPIRY_MS,
      }),
    ).toBe(false);
  });

  it("abandons only after verify returns expired or failed", () => {
    expect(
      canAbandonFincraOpenPaymentAfterVerify({
        results: [result("pay_1-a1", { kind: "expired", reason: "status:expired" }, "expired")],
        paymentCreatedAt: createdAt,
      }),
    ).toBe(true);
    expect(
      canAbandonFincraOpenPaymentAfterVerify({
        results: [result("pay_1-a1", { kind: "failed", reason: "status:failed" }, "failed")],
        paymentCreatedAt: createdAt,
      }),
    ).toBe(true);
  });

  it("abandons not-found only after the provider expiry window", () => {
    const notFound: TFincraAttemptVerifyResult = { merchantReference: "pay_1-a1", kind: "not_found" };
    expect(
      canAbandonFincraOpenPaymentAfterVerify({
        results: [notFound],
        paymentCreatedAt: createdAt,
        nowMs: createdAt.getTime() + 15 * 60 * 1000,
      }),
    ).toBe(false);
    expect(
      canAbandonFincraOpenPaymentAfterVerify({
        results: [notFound],
        paymentCreatedAt: createdAt,
        nowMs: createdAt.getTime() + FINCRA_PROVIDER_EXPIRY_MS,
      }),
    ).toBe(true);
  });
});

describe("summarizeFincraAttemptVerifications", () => {
  it("prefers a paid prior reference so retry can process paid instead of rotating", () => {
    const summary = summarizeFincraAttemptVerifications(
      [
        result("pay_1-a1", {
          kind: "paid",
          amountReceivedMinor: BigInt(18500000),
          varianceType: "exact",
          feeMinor: BigInt(301),
        }),
        result("pay_1-a2", { kind: "pending", reason: "status:pending" }, "pending"),
      ],
      { paymentCreatedAt: createdAt },
    );
    expect(summary.paid?.merchantReference).toBe("pay_1-a1");
    expect(summary.hasPending).toBe(true);
    expect(summary.allAbandonable).toBe(false);
  });

  it("keeps pending retries rotatable and not abandonable", () => {
    const summary = summarizeFincraAttemptVerifications(
      [result("pay_1-a1", { kind: "pending", reason: "status:pending" }, "pending")],
      { paymentCreatedAt: createdAt },
    );
    expect(summary.paid).toBeNull();
    expect(summary.hasPending).toBe(true);
    expect(summary.allAbandonable).toBe(false);
  });
});
