import { and, asc, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { checkoutExtra, checkoutExtraPrice } from "@/lib/db/schema/checkout-extra";
import { planExtraPriceWrites } from "@/lib/checkout-extras/price-plan";
import { toCheckoutExtraAdmin } from "@/lib/checkout-extras/map-extra";
import type { TCheckoutExtraAdmin, TCheckoutExtraWrite } from "@/lib/checkout-extras/types";

export class CheckoutExtraAdminError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND",
  ) {
    super(message);
    this.name = "CheckoutExtraAdminError";
  }
}

const loadPrices = async (tx: DbTransaction, extraIds: string[]) => {
  if (extraIds.length === 0) return [];
  return tx
    .select({
      extraId: checkoutExtraPrice.extraId,
      currency: checkoutExtraPrice.currency,
      amountMinor: checkoutExtraPrice.amountMinor,
    })
    .from(checkoutExtraPrice)
    .where(inArray(checkoutExtraPrice.extraId, extraIds));
};

export const listCheckoutExtras = async (tx: DbTransaction): Promise<TCheckoutExtraAdmin[]> => {
  const rows = await tx
    .select({
      id: checkoutExtra.id,
      key: checkoutExtra.key,
      enabled: checkoutExtra.enabled,
      chargeBasis: checkoutExtra.chargeBasis,
      baseCurrency: checkoutExtra.baseCurrency,
      baseAmountMinor: checkoutExtra.baseAmountMinor,
      labelI18n: checkoutExtra.labelI18n,
      descriptionI18n: checkoutExtra.descriptionI18n,
      promiseI18n: checkoutExtra.promiseI18n,
      termsUrl: checkoutExtra.termsUrl,
      sortOrder: checkoutExtra.sortOrder,
    })
    .from(checkoutExtra)
    .orderBy(asc(checkoutExtra.sortOrder), asc(checkoutExtra.key));

  const prices = await loadPrices(
    tx,
    rows.map((row) => row.id),
  );
  const pricesByExtra = new Map<string, { currency: string; amountMinor: number }[]>();
  for (const price of prices) {
    const list = pricesByExtra.get(price.extraId) ?? [];
    list.push({ currency: price.currency, amountMinor: price.amountMinor });
    pricesByExtra.set(price.extraId, list);
  }

  return rows.flatMap((row) => {
    const mapped = toCheckoutExtraAdmin(row, pricesByExtra.get(row.id) ?? []);
    return mapped ? [mapped] : [];
  });
};

export const saveCheckoutExtra = async (
  tx: DbTransaction,
  key: string,
  write: TCheckoutExtraWrite,
): Promise<{ before: TCheckoutExtraAdmin; after: TCheckoutExtraAdmin }> => {
  const existingRows = await tx
    .select({
      id: checkoutExtra.id,
      key: checkoutExtra.key,
      enabled: checkoutExtra.enabled,
      chargeBasis: checkoutExtra.chargeBasis,
      baseCurrency: checkoutExtra.baseCurrency,
      baseAmountMinor: checkoutExtra.baseAmountMinor,
      labelI18n: checkoutExtra.labelI18n,
      descriptionI18n: checkoutExtra.descriptionI18n,
      promiseI18n: checkoutExtra.promiseI18n,
      termsUrl: checkoutExtra.termsUrl,
      sortOrder: checkoutExtra.sortOrder,
    })
    .from(checkoutExtra)
    .where(eq(checkoutExtra.key, key))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) {
    throw new CheckoutExtraAdminError("Checkout extra was not found.", "NOT_FOUND");
  }

  const existingPrices = await loadPrices(tx, [existing.id]);
  const before = toCheckoutExtraAdmin(
    existing,
    existingPrices.map((price) => ({ currency: price.currency, amountMinor: price.amountMinor })),
  );
  if (!before) {
    throw new CheckoutExtraAdminError("Checkout extra was not found.", "NOT_FOUND");
  }

  await tx
    .update(checkoutExtra)
    .set({
      enabled: write.enabled,
      baseCurrency: write.baseCurrency,
      baseAmountMinor: write.baseAmountMinor,
      labelI18n: write.labelI18n,
      descriptionI18n: write.descriptionI18n,
      promiseI18n: write.promiseI18n,
      termsUrl: write.termsUrl,
      updatedAt: new Date(),
    })
    .where(eq(checkoutExtra.id, existing.id));

  const plan = planExtraPriceWrites(
    existingPrices.map((price) => ({ currency: price.currency, amountMinor: price.amountMinor })),
    write.prices,
  );

  if (plan.deleteCurrencies.length > 0) {
    await tx
      .delete(checkoutExtraPrice)
      .where(
        and(
          eq(checkoutExtraPrice.extraId, existing.id),
          inArray(checkoutExtraPrice.currency, plan.deleteCurrencies),
        ),
      );
  }

  for (const price of plan.upserts) {
    await tx
      .insert(checkoutExtraPrice)
      .values({
        extraId: existing.id,
        currency: price.currency,
        amountMinor: price.amountMinor,
      })
      .onConflictDoUpdate({
        target: [checkoutExtraPrice.extraId, checkoutExtraPrice.currency],
        set: { amountMinor: price.amountMinor, updatedAt: new Date() },
      });
  }

  const saved = await listCheckoutExtras(tx);
  const after = saved.find((extra) => extra.key === before.key);
  if (!after) {
    throw new CheckoutExtraAdminError("Checkout extra was not found.", "NOT_FOUND");
  }
  return { before, after };
};
