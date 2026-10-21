import type { FincraVerifiedPayment } from "@/lib/payments/fincra-client";

export type TFincraVerifyDecision =
  | {
      kind: "paid";
      amountReceivedMinor: bigint;
      varianceType: "exact" | "overpayment";
      feeMinor: bigint | null;
    }
  | {
      kind: "underpaid";
      amountReceivedMinor: bigint | null;
      varianceType: "underpayment";
      feeMinor: bigint | null;
    }
  | { kind: "pending"; reason: string }
  | { kind: "rejected"; reason: string };

const receivedMinor = (verified: FincraVerifiedPayment): bigint | null =>
  verified.amountReceivedMinor ?? verified.amountMinor;

export const decideFincraVerifiedPayment = (params: {
  verified: FincraVerifiedPayment;
  expectedMinor: bigint;
  expectedCurrency: string;
}): TFincraVerifyDecision => {
  const { verified, expectedMinor } = params;
  const expectedCurrency = params.expectedCurrency.trim().toUpperCase();
  const status = verified.status.trim().toLowerCase();

  if (status !== "success") {
    return { kind: "pending", reason: `status:${status || "missing"}` };
  }

  if (verified.currency.trim().toUpperCase() !== expectedCurrency) {
    return { kind: "rejected", reason: "currency_mismatch" };
  }

  const variance = verified.varianceType?.trim().toLowerCase() ?? null;
  const got = receivedMinor(verified);

  if (variance === "underpayment") {
    return {
      kind: "underpaid",
      amountReceivedMinor: got,
      varianceType: "underpayment",
      feeMinor: verified.feeMinor,
    };
  }

  if (got === null) {
    return { kind: "pending", reason: "missing_amount_received" };
  }

  if (got < expectedMinor) {
    return {
      kind: "underpaid",
      amountReceivedMinor: got,
      varianceType: "underpayment",
      feeMinor: verified.feeMinor,
    };
  }

  return {
    kind: "paid",
    amountReceivedMinor: got,
    varianceType: got > expectedMinor || variance === "overpayment" ? "overpayment" : "exact",
    feeMinor: verified.feeMinor,
  };
};
