import {
  FincraProviderError,
  lookupFincraCheckoutByMerchantReference,
  type FincraVerifiedPayment,
} from "@/lib/payments/fincra-client";
import {
  decideFincraVerifiedPayment,
  type TFincraVerifyDecision,
} from "@/lib/payments/fincra-verify";
import { getFincraServerConfig } from "@/lib/payments/resolve-payment-provider";
import type { TFincraStoredPaymentRef } from "@/lib/payments/fincra-charge-match";

/** Fincra pending charges auto-expire after two hours. */
export const FINCRA_PROVIDER_EXPIRY_MS = 2 * 60 * 60 * 1000;

export type TFincraAttemptVerifyResult =
  | {
      merchantReference: string;
      kind: "verified";
      verified: FincraVerifiedPayment;
      decision: TFincraVerifyDecision;
    }
  | { merchantReference: string; kind: "not_found" }
  | { merchantReference: string; kind: "error"; message: string };

export type TFincraAttemptVerifySummary = {
  paid: Extract<TFincraAttemptVerifyResult, { kind: "verified" }> | null;
  extraPaid: Array<Extract<TFincraAttemptVerifyResult, { kind: "verified" }>>;
  mismatch: Extract<TFincraAttemptVerifyResult, { kind: "verified" }> | null;
  hasPending: boolean;
  hasVerifyError: boolean;
  allAbandonable: boolean;
};

export const isFincraDecisionAbandonable = (decision: TFincraVerifyDecision): boolean =>
  decision.kind === "expired" || decision.kind === "failed";

export const canAbandonFincraOpenPaymentAfterVerify = (params: {
  results: TFincraAttemptVerifyResult[];
  paymentCreatedAt: Date;
  nowMs?: number;
}): boolean => {
  if (params.results.length === 0) return false;
  if (params.results.some((result) => result.kind === "error")) return false;
  const pastExpiry =
    (params.nowMs ?? Date.now()) - params.paymentCreatedAt.getTime() >= FINCRA_PROVIDER_EXPIRY_MS;
  return params.results.every((result) => {
    if (result.kind === "not_found") return pastExpiry;
    if (result.kind === "verified") return isFincraDecisionAbandonable(result.decision);
    return false;
  });
};

export const summarizeFincraAttemptVerifications = (
  results: TFincraAttemptVerifyResult[],
  params: { paymentCreatedAt: Date; nowMs?: number },
): TFincraAttemptVerifySummary => {
  const paidMatches = results.filter(
    (result): result is Extract<TFincraAttemptVerifyResult, { kind: "verified" }> =>
      result.kind === "verified" &&
      (result.decision.kind === "paid" || result.decision.kind === "extra_collection"),
  );
  const [paid, ...extraPaid] = paidMatches;
  const mismatch =
    results.find(
      (result): result is Extract<TFincraAttemptVerifyResult, { kind: "verified" }> =>
        result.kind === "verified" && result.decision.kind === "mismatch",
    ) ?? null;
  return {
    paid: paid ?? null,
    extraPaid,
    mismatch,
    hasPending: results.some(
      (result) => result.kind === "verified" && result.decision.kind === "pending",
    ),
    hasVerifyError: results.some((result) => result.kind === "error"),
    allAbandonable: canAbandonFincraOpenPaymentAfterVerify({
      results,
      paymentCreatedAt: params.paymentCreatedAt,
      nowMs: params.nowMs,
    }),
  };
};

export const verifyFincraMerchantReferences = async (params: {
  merchantReferences: string[];
  payment: (TFincraStoredPaymentRef & { settledMerchantReference?: string | null }) | null;
  alreadyPaid?: boolean;
  timeoutMs?: number;
}): Promise<TFincraAttemptVerifyResult[]> => {
  let cfg;
  try {
    cfg = getFincraServerConfig();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fincra not configured";
    return params.merchantReferences.map((merchantReference) => ({
      merchantReference,
      kind: "error",
      message,
    }));
  }

  const results: TFincraAttemptVerifyResult[] = [];
  for (const merchantReference of params.merchantReferences) {
    try {
      const lookup = await lookupFincraCheckoutByMerchantReference({
        apiBaseUrl: cfg.apiBaseUrl,
        secretKey: cfg.secretKey,
        businessId: cfg.businessId,
        merchantReference,
        timeoutMs: params.timeoutMs ?? 8000,
      });
      if (lookup.kind === "not_found") {
        results.push({ merchantReference, kind: "not_found" });
        continue;
      }
      results.push({
        merchantReference,
        kind: "verified",
        verified: lookup.payment,
        decision: decideFincraVerifiedPayment({
          verified: lookup.payment,
          payment: params.payment,
          merchantReference,
          alreadyPaid: params.alreadyPaid,
          settledMerchantReference: params.payment?.settledMerchantReference,
        }),
      });
    } catch (e) {
      const message =
        e instanceof FincraProviderError ? e.message : e instanceof Error ? e.message : String(e);
      results.push({ merchantReference, kind: "error", message });
    }
  }
  return results;
};
