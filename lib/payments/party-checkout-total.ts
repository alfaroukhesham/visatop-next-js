import type { CheckoutTotal } from "@/lib/pricing/resolve-customer-catalog-price";

export type TPartyLine = {
  applicationId: string;
  serviceId: string;
  amountMinor: bigint;
  currency: string;
};

export const sumPartyLines = (lines: TPartyLine[]): bigint =>
  lines.reduce((acc, l) => acc + l.amountMinor, BigInt(0));

/**
 * Sum the displayMinor of N checkout totals. Returns the summed minor, or null
 * if any total is missing or the currencies are mixed. Callers map null to a
 * 400 `pricing_unavailable` (or mixed-currency) error.
 */
export const sumCheckoutTotals = (totals: Array<CheckoutTotal | null>): bigint | null => {
  if (totals.length === 0) return BigInt(0);
  const firstCurrency = totals[0]?.currency ?? null;
  if (!firstCurrency) return null;
  let sum = BigInt(0);
  for (const t of totals) {
    if (!t) return null;
    if (t.currency !== firstCurrency) return null;
    sum += t.displayMinor;
  }
  return sum;
};
