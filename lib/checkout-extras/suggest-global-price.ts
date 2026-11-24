import { convertAedMajorToUsdMajor, convertUsdMajorToAedMajor } from "@/lib/admin/catalog/service-price-fx-fill";

export type TGlobalCheckoutCurrency = "USD" | "AED";

export type TSuggestMissingGlobalPriceInput = {
  usdMajor: string;
  aedMajor: string;
  fxAedPerUsd: string | null;
};

/**
 * Suggest the blank USD or AED field from the other, using the stored display rate.
 * Does not overwrite a value the admin already typed. Local currencies are never filled.
 */
export const suggestMissingGlobalPrice = (
  input: TSuggestMissingGlobalPriceInput,
): { currency: TGlobalCheckoutCurrency; amountMajor: string } | null => {
  const rate = input.fxAedPerUsd?.trim() ?? "";
  if (!rate) return null;
  const usd = input.usdMajor.trim();
  const aed = input.aedMajor.trim();
  if ((usd === "") === (aed === "")) return null;

  try {
    if (usd !== "") {
      const amountMajor = convertUsdMajorToAedMajor(usd, rate);
      return amountMajor ? { currency: "AED", amountMajor } : null;
    }
    const amountMajor = convertAedMajorToUsdMajor(aed, rate);
    return amountMajor ? { currency: "USD", amountMajor } : null;
  } catch {
    return null;
  }
};
