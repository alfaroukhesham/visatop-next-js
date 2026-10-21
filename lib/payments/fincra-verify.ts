import type { FincraVerifiedPayment } from "@/lib/payments/fincra-client";
import {
  matchFincraChargeToStoredPayment,
  type TFincraStoredPaymentRef,
} from "@/lib/payments/fincra-charge-match";

export type TFincraVerifyDecision =
  | {
      kind: "paid";
      amountReceivedMinor: bigint;
      varianceType: "exact";
      feeMinor: bigint | null;
    }
  | {
      kind: "mismatch";
      reason: "amount_mismatch" | "currency_mismatch";
      amountReceivedMinor: bigint | null;
      expectedMinor: bigint;
      expectedCurrency: string;
      reportedCurrency: string;
      feeMinor: bigint | null;
    }
  | { kind: "unknown_reference" }
  | { kind: "pending"; reason: string };

const receivedMinor = (verified: FincraVerifiedPayment): bigint | null =>
  verified.amountReceivedMinor ?? verified.amountMinor;

export const decideFincraVerifiedPayment = (params: {
  verified: FincraVerifiedPayment;
  payment: TFincraStoredPaymentRef | null | undefined;
  merchantReference?: string | null;
}): TFincraVerifyDecision => {
  const { verified, payment } = params;
  const merchantReference = params.merchantReference ?? verified.merchantReference;
  const match = matchFincraChargeToStoredPayment({
    payment,
    merchantReference,
    reportedAmountMinor: receivedMinor(verified),
    reportedCurrency: verified.currency,
  });

  if (match.kind === "unknown_reference") {
    return { kind: "unknown_reference" };
  }

  const status = verified.status.trim().toLowerCase();
  if (status !== "success") {
    return { kind: "pending", reason: `status:${status || "missing"}` };
  }

  if (match.kind === "mismatch") {
    return {
      kind: "mismatch",
      reason: match.reason,
      amountReceivedMinor: match.reportedMinor,
      expectedMinor: match.expectedMinor,
      expectedCurrency: match.expectedCurrency,
      reportedCurrency: match.reportedCurrency,
      feeMinor: verified.feeMinor,
    };
  }

  return {
    kind: "paid",
    amountReceivedMinor: match.amountMinor,
    varianceType: "exact",
    feeMinor: verified.feeMinor,
  };
};
