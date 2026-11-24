import type { TCheckoutExtraPriceWrite } from "@/lib/checkout-extras/types";

export type TExtraPricePlan = {
  upserts: TCheckoutExtraPriceWrite[];
  deleteCurrencies: string[];
};

/** Stored per-currency rows are replaced by the admin list. Unchanged amounts are left alone. */
export const planExtraPriceWrites = (
  existing: readonly TCheckoutExtraPriceWrite[],
  next: readonly TCheckoutExtraPriceWrite[],
): TExtraPricePlan => {
  const existingByCurrency = new Map(existing.map((price) => [price.currency, price.amountMinor]));
  const nextByCurrency = new Map(next.map((price) => [price.currency, price.amountMinor]));
  const deleteCurrencies = [...existingByCurrency.keys()].filter((currency) => !nextByCurrency.has(currency));
  const upserts = [...nextByCurrency.entries()]
    .filter(([currency, amountMinor]) => existingByCurrency.get(currency) !== amountMinor)
    .map(([currency, amountMinor]) => ({ currency, amountMinor }));
  return { deleteCurrencies, upserts };
};
