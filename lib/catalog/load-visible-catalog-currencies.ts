import { and, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  visibleCurrenciesForNationality,
  type TVisibleCatalogCurrency,
} from "@/lib/catalog/local-currency";

export const loadVisibleCatalogCurrencies = async (
  tx: DbTransaction,
  nationalityCode: string,
): Promise<TVisibleCatalogCurrency[]> => {
  const [currencies, links] = await Promise.all([
    tx
      .select({
        code: schema.catalogCurrency.code,
        kind: schema.catalogCurrency.kind,
        enabled: schema.catalogCurrency.enabled,
      })
      .from(schema.catalogCurrency),
    tx
      .select({
        currencyCode: schema.catalogCurrencyNationality.currencyCode,
        nationalityCode: schema.catalogCurrencyNationality.nationalityCode,
      })
      .from(schema.catalogCurrencyNationality),
  ]);
  return visibleCurrenciesForNationality(currencies, links, nationalityCode);
};

export const loadLocalPricedServiceIds = async (
  tx: DbTransaction,
  nationalityCode: string,
  localCurrencyCode: string,
): Promise<string[]> => {
  const rows = await tx
    .select({
      serviceId: schema.catalogCustomerPrice.serviceId,
    })
    .from(schema.catalogCustomerPrice)
    .where(
      and(
        eq(schema.catalogCustomerPrice.nationalityCode, nationalityCode),
        eq(schema.catalogCustomerPrice.currency, localCurrencyCode),
      ),
    );
  return [...new Set(rows.map((r) => r.serviceId))];
};

export const firstLocalCurrencyCode = (
  visible: TVisibleCatalogCurrency[],
): string | null => visible.find((c) => c.kind === "local")?.code ?? null;
