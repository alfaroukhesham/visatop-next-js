import type { FincraVerifiedPayment } from "@/lib/payments/fincra-client";
import {
  matchFincraChargeToStoredPayment,
  type TFincraStoredPaymentRef,
} from "@/lib/payments/fincra-charge-match";

export type TFincraMismatchReason =
  | "amount_mismatch"
  | "currency_mismatch"
  | "variance_underpayment"
  | "variance_overpayment";

export type TFincraAmountAuditFields = {
  amount: string;
  amountReceived: string | null;
  amountExpected: string | null;
  amountToSettle: string | null;
  fee: string | null;
  varianceType: string | null;
  currency: string;
  reference: string | null;
  merchantReference: string | null;
  status: string;
};

export type TFincraVerifyDecision =
  | {
      kind: "paid";
      amountReceivedMinor: bigint;
      varianceType: "exact";
      feeMinor: bigint | null;
    }
  | {
      kind: "extra_collection";
      amountReceivedMinor: bigint;
      varianceType: "exact";
      feeMinor: bigint | null;
      merchantReference: string;
    }
  | {
      kind: "mismatch";
      reason: TFincraMismatchReason;
      amountReceivedMinor: bigint | null;
      expectedMinor: bigint;
      expectedCurrency: string;
      reportedCurrency: string;
      feeMinor: bigint | null;
      amountAudit: TFincraAmountAuditFields;
    }
  | { kind: "unknown_reference" }
  | { kind: "pending"; reason: string }
  | { kind: "expired"; reason: string }
  | { kind: "failed"; reason: string };

/** Customer-paid amount: amountReceived, falling back to amount. Never amountToSettle. */
export const fincraCustomerPaidMinor = (verified: FincraVerifiedPayment): bigint | null =>
  verified.amountReceivedMinor ?? verified.amountMinor;

export const isFincraSuccessStatus = (status: string): boolean => {
  const normalized = status.trim().toLowerCase();
  return normalized === "success" || normalized === "successful";
};

export const fincraAmountAuditFields = (verified: FincraVerifiedPayment): TFincraAmountAuditFields => ({
  amount: verified.amountMinor.toString(),
  amountReceived: verified.amountReceivedMinor?.toString() ?? null,
  amountExpected: verified.amountExpectedMinor?.toString() ?? null,
  amountToSettle: verified.amountToSettleMinor?.toString() ?? null,
  fee: verified.feeMinor?.toString() ?? null,
  varianceType: verified.varianceType,
  currency: verified.currency,
  reference: verified.reference,
  merchantReference: verified.merchantReference,
  status: verified.status,
});

export const mismatchReasonFromVarianceType = (
  varianceType: string | null | undefined,
): TFincraMismatchReason | null => {
  const variance = varianceType?.trim().toLowerCase() ?? "";
  if (!variance) return null;
  if (variance === "underpayment") return "variance_underpayment";
  if (variance === "overpayment") return "variance_overpayment";
  return "amount_mismatch";
};

const incomingDiffersFromSettled = (params: {
  payment: TFincraStoredPaymentRef;
  incomingReference: string;
  settledMerchantReference?: string | null;
}): boolean => {
  const incoming = params.incomingReference.trim();
  if (!incoming) return false;
  const settled = params.settledMerchantReference?.trim() ?? "";
  if (settled) return incoming !== settled;
  const current = params.payment.providerOperationId?.trim() || params.payment.id;
  return incoming !== current && incoming !== params.payment.id;
};

export const decideFincraVerifiedPayment = (params: {
  verified: FincraVerifiedPayment;
  payment: (TFincraStoredPaymentRef & { settledMerchantReference?: string | null }) | null | undefined;
  merchantReference?: string | null;
  alreadyPaid?: boolean;
  settledMerchantReference?: string | null;
}): TFincraVerifyDecision => {
  const { verified, payment } = params;
  const merchantReference = params.merchantReference ?? verified.merchantReference;
  const reportedAmountMinor = fincraCustomerPaidMinor(verified);
  const match = matchFincraChargeToStoredPayment({
    payment,
    merchantReference,
    reportedAmountMinor,
    reportedCurrency: verified.currency,
  });

  if (match.kind === "unknown_reference" || !payment) {
    return { kind: "unknown_reference" };
  }

  const status = verified.status.trim().toLowerCase();
  if (status === "expired") {
    return { kind: "expired", reason: "status:expired" };
  }
  if (status === "failed") {
    return { kind: "failed", reason: "status:failed" };
  }
  if (!isFincraSuccessStatus(status)) {
    return { kind: "pending", reason: `status:${status || "missing"}` };
  }

  const amountAudit = fincraAmountAuditFields(verified);
  const varianceReason = mismatchReasonFromVarianceType(verified.varianceType);
  if (varianceReason) {
    return {
      kind: "mismatch",
      reason: varianceReason,
      amountReceivedMinor: reportedAmountMinor,
      expectedMinor: payment.amount,
      expectedCurrency: payment.currency,
      reportedCurrency: verified.currency,
      feeMinor: verified.feeMinor,
      amountAudit,
    };
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
      amountAudit,
    };
  }

  const incoming = (merchantReference ?? "").trim();
  if (
    params.alreadyPaid &&
    payment &&
    incomingDiffersFromSettled({
      payment,
      incomingReference: incoming,
      settledMerchantReference: params.settledMerchantReference ?? payment.settledMerchantReference,
    })
  ) {
    return {
      kind: "extra_collection",
      amountReceivedMinor: match.amountMinor,
      varianceType: "exact",
      feeMinor: verified.feeMinor,
      merchantReference: incoming,
    };
  }

  return {
    kind: "paid",
    amountReceivedMinor: match.amountMinor,
    varianceType: "exact",
    feeMinor: verified.feeMinor,
  };
};
