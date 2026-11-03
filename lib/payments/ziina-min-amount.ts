import { fxUsdToAed } from "@/lib/pricing/fx-convert";

/** Ziina docs: minimum payment is 2 AED, sent in fils (minor units). */
export const ZIINA_MIN_AMOUNT_AED_MINOR = 200;

export type TZiinaMinAmountInput = {
  amountMinor: number | bigint;
  currency: string;
  aedPerUsd?: number | string | null;
};

export const sanitizeZiinaProviderBody = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  const stripped = raw
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return null;
  return stripped.slice(0, 500);
};

export const ziinaProviderBodyLooksLikeMinimum = (raw: string | null | undefined): boolean => {
  if (!raw) return false;
  return /minimum|min(?:imum)? amount|at least 2|2\s*aed/i.test(raw);
};

export const aedMinorForZiinaPresentment = (input: TZiinaMinAmountInput): bigint | null => {
  const currency = input.currency.trim().toUpperCase();
  const amount = typeof input.amountMinor === "bigint" ? input.amountMinor : BigInt(input.amountMinor);
  if (amount < BigInt(0)) return null;
  if (currency === "AED") return amount;
  if (currency === "USD") {
    const rate = input.aedPerUsd;
    if (rate == null || rate === "") return null;
    try {
      return fxUsdToAed(amount, rate);
    } catch {
      return null;
    }
  }
  return null;
};

export const isBelowZiinaMinimum = (input: TZiinaMinAmountInput): boolean => {
  const aedMinor = aedMinorForZiinaPresentment(input);
  if (aedMinor == null) return false;
  return aedMinor < BigInt(ZIINA_MIN_AMOUNT_AED_MINOR);
};
