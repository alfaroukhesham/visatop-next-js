import { parseAdminPriceMajorInput } from "@/lib/admin/catalog/parse-admin-price-input";

/** Checkout currencies charged in whole major units. NGN and ZAR reject kobo/cents. */
const WHOLE_UNIT_CURRENCIES = new Set(["NGN", "ZAR"]);

export const isWholeUnitCurrency = (currency: string): boolean =>
  WHOLE_UNIT_CURRENCIES.has(currency.trim().toUpperCase());

export const formatCheckoutMajor = (minor: bigint, currency: string): string => {
  const negative = minor < BigInt(0);
  const abs = negative ? -minor : minor;
  const whole = abs / BigInt(100);
  const fraction = abs % BigInt(100);
  const sign = negative ? "-" : "";
  if (isWholeUnitCurrency(currency) && fraction === BigInt(0)) {
    return `${sign}${whole.toString()}`;
  }
  return `${sign}${whole.toString()}.${fraction.toString().padStart(2, "0")}`;
};

/** Non-zero minor units on a whole-unit currency. Null when the amount is not a positive price. */
export const wholeUnitPriceMessage = (amountMajor: string, currency: string): string | null => {
  if (!isWholeUnitCurrency(currency)) return null;
  const minor = parseAdminPriceMajorInput(amountMajor);
  if (minor === null) return null;
  if (minor % BigInt(100) !== BigInt(0)) return "Enter a whole number";
  return null;
};
