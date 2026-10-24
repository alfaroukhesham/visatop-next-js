import { parseFincraAttemptReference } from "@/lib/payments/fincra-attempt-reference";

export type TFincraStoredPaymentRef = {
  id: string;
  amount: bigint;
  currency: string;
  providerOperationId?: string | null;
};

export type TFincraChargeMatchResult =
  | { kind: "match"; amountMinor: bigint; currency: string }
  | {
      kind: "mismatch";
      reason: "amount_mismatch" | "currency_mismatch";
      expectedMinor: bigint;
      expectedCurrency: string;
      reportedMinor: bigint | null;
      reportedCurrency: string;
    }
  | { kind: "unknown_reference" };

const referenceMapsToPayment = (
  payment: TFincraStoredPaymentRef,
  merchantReference: string | null | undefined,
): boolean => {
  const ref = merchantReference?.trim() ?? "";
  if (!ref) return true;
  const operationId = payment.providerOperationId?.trim() ?? "";
  if (ref === payment.id || (operationId.length > 0 && ref === operationId)) return true;
  const parsed = parseFincraAttemptReference(ref);
  return Boolean(parsed && parsed.paymentId === payment.id);
};

export const matchFincraChargeToStoredPayment = (params: {
  payment: TFincraStoredPaymentRef | null | undefined;
  merchantReference?: string | null;
  reportedAmountMinor: bigint | null;
  reportedCurrency: string;
}): TFincraChargeMatchResult => {
  const { payment } = params;
  if (!payment) return { kind: "unknown_reference" };
  if (!referenceMapsToPayment(payment, params.merchantReference)) {
    return { kind: "unknown_reference" };
  }

  const expectedCurrency = payment.currency.trim().toUpperCase();
  const reportedCurrency = params.reportedCurrency.trim().toUpperCase();
  if (!reportedCurrency || reportedCurrency !== expectedCurrency) {
    return {
      kind: "mismatch",
      reason: "currency_mismatch",
      expectedMinor: payment.amount,
      expectedCurrency,
      reportedMinor: params.reportedAmountMinor,
      reportedCurrency: reportedCurrency || "missing",
    };
  }

  if (params.reportedAmountMinor === null || params.reportedAmountMinor !== payment.amount) {
    return {
      kind: "mismatch",
      reason: "amount_mismatch",
      expectedMinor: payment.amount,
      expectedCurrency,
      reportedMinor: params.reportedAmountMinor,
      reportedCurrency,
    };
  }

  return { kind: "match", amountMinor: payment.amount, currency: expectedCurrency };
};
