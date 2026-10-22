import { and, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { isIso4217CurrencyCode } from "@/lib/catalog/local-currency";

export type TAdminLocalCurrency = {
  code: string;
  enabled: boolean;
  nationalityCodes: string[];
  nationalities: Array<{ code: string; name: string }>;
};

export type TAdminLocalCurrencyPriceRow = {
  serviceId: string;
  serviceName: string;
  enabled: boolean;
  usdMinor: string | null;
  aedMinor: string | null;
  localMinor: string | null;
};

export class LocalCurrencyAdminError extends Error {
  constructor(
    message: string,
    readonly code: "VALIDATION" | "CONFLICT" | "NOT_FOUND",
  ) {
    super(message);
    this.name = "LocalCurrencyAdminError";
  }
}

const toMinorString = (value: number | null | undefined): string | null => {
  if (value == null || !Number.isInteger(value)) return null;
  return String(value);
};

export const listAdminLocalCurrencies = async (
  tx: DbTransaction,
): Promise<TAdminLocalCurrency[]> => {
  const [currencies, links, nationalities] = await Promise.all([
    tx
      .select({
        code: schema.catalogCurrency.code,
        enabled: schema.catalogCurrency.enabled,
      })
      .from(schema.catalogCurrency)
      .where(eq(schema.catalogCurrency.kind, "local")),
    tx
      .select({
        currencyCode: schema.catalogCurrencyNationality.currencyCode,
        nationalityCode: schema.catalogCurrencyNationality.nationalityCode,
      })
      .from(schema.catalogCurrencyNationality),
    tx
      .select({
        code: schema.nationality.code,
        name: schema.nationality.name,
      })
      .from(schema.nationality),
  ]);

  const nameByCode = new Map(nationalities.map((n) => [n.code, n.name]));
  const linksByCurrency = new Map<string, string[]>();
  for (const link of links) {
    const list = linksByCurrency.get(link.currencyCode) ?? [];
    list.push(link.nationalityCode);
    linksByCurrency.set(link.currencyCode, list);
  }

  return currencies
    .map((c) => {
      const nationalityCodes = (linksByCurrency.get(c.code) ?? []).sort();
      return {
        code: c.code,
        enabled: c.enabled,
        nationalityCodes,
        nationalities: nationalityCodes.map((code) => ({
          code,
          name: nameByCode.get(code) ?? code,
        })),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
};

export const createAdminLocalCurrency = async (
  tx: DbTransaction,
  input: { code: string; nationalityCodes: string[]; enabled?: boolean },
): Promise<TAdminLocalCurrency> => {
  const code = input.code.trim().toUpperCase();
  if (!isIso4217CurrencyCode(code)) {
    throw new LocalCurrencyAdminError("Currency must be a 3-letter ISO 4217 code.", "VALIDATION");
  }
  const nationalityCodes = uniqueNationalityCodes(input.nationalityCodes);
  if (nationalityCodes.length === 0) {
    throw new LocalCurrencyAdminError("Link at least one nationality.", "VALIDATION");
  }
  await assertNationalitiesExist(tx, nationalityCodes);

  const existing = await tx
    .select({
      code: schema.catalogCurrency.code,
      kind: schema.catalogCurrency.kind,
    })
    .from(schema.catalogCurrency)
    .where(eq(schema.catalogCurrency.code, code))
    .limit(1);
  if (existing[0]?.kind === "global") {
    throw new LocalCurrencyAdminError("That code is already a global currency.", "CONFLICT");
  }
  if (existing[0]) {
    throw new LocalCurrencyAdminError("That local currency already exists. Edit its nationality links instead.", "CONFLICT");
  }

  await tx.insert(schema.catalogCurrency).values({
    code,
    kind: "local",
    enabled: input.enabled ?? true,
  });
  await replaceNationalityLinks(tx, code, nationalityCodes);
  const created = (await listAdminLocalCurrencies(tx)).find((c) => c.code === code);
  if (!created) throw new LocalCurrencyAdminError("Create failed.", "NOT_FOUND");
  return created;
};

export const updateAdminLocalCurrency = async (
  tx: DbTransaction,
  codeRaw: string,
  input: { nationalityCodes?: string[]; enabled?: boolean },
): Promise<TAdminLocalCurrency> => {
  const code = codeRaw.trim().toUpperCase();
  const existing = await tx
    .select({
      code: schema.catalogCurrency.code,
      kind: schema.catalogCurrency.kind,
    })
    .from(schema.catalogCurrency)
    .where(eq(schema.catalogCurrency.code, code))
    .limit(1);
  const row = existing[0];
  if (!row || row.kind !== "local") {
    throw new LocalCurrencyAdminError("Local currency not found.", "NOT_FOUND");
  }

  if (input.enabled !== undefined) {
    await tx
      .update(schema.catalogCurrency)
      .set({ enabled: input.enabled })
      .where(eq(schema.catalogCurrency.code, code));
  }
  if (input.nationalityCodes) {
    const nationalityCodes = uniqueNationalityCodes(input.nationalityCodes);
    if (nationalityCodes.length === 0) {
      throw new LocalCurrencyAdminError("Link at least one nationality.", "VALIDATION");
    }
    await assertNationalitiesExist(tx, nationalityCodes);
    await replaceNationalityLinks(tx, code, nationalityCodes);
  }

  const updated = (await listAdminLocalCurrencies(tx)).find((c) => c.code === code);
  if (!updated) throw new LocalCurrencyAdminError("Local currency not found.", "NOT_FOUND");
  return updated;
};

export const deleteAdminLocalCurrency = async (
  tx: DbTransaction,
  codeRaw: string,
): Promise<{ code: string }> => {
  const code = codeRaw.trim().toUpperCase();
  const existing = await tx
    .select({
      code: schema.catalogCurrency.code,
      kind: schema.catalogCurrency.kind,
    })
    .from(schema.catalogCurrency)
    .where(eq(schema.catalogCurrency.code, code))
    .limit(1);
  if (!existing[0] || existing[0].kind !== "local") {
    throw new LocalCurrencyAdminError("Local currency not found.", "NOT_FOUND");
  }
  await tx.delete(schema.catalogCurrency).where(eq(schema.catalogCurrency.code, code));
  return { code };
};

export const listAdminLocalCurrencyPrices = async (
  tx: DbTransaction,
  currencyCode: string,
  nationalityCode: string,
): Promise<TAdminLocalCurrencyPriceRow[]> => {
  const services = await tx
    .select({
      id: schema.visaService.id,
      name: schema.visaService.name,
      enabled: schema.visaService.enabled,
    })
    .from(schema.visaService)
    .orderBy(schema.visaService.name);

  if (services.length === 0) return [];

  const prices = await tx
    .select({
      serviceId: schema.catalogCustomerPrice.serviceId,
      currency: schema.catalogCustomerPrice.currency,
      amountMinor: schema.catalogCustomerPrice.amountMinor,
    })
    .from(schema.catalogCustomerPrice)
    .where(
      and(
        eq(schema.catalogCustomerPrice.nationalityCode, nationalityCode),
        inArray(
          schema.catalogCustomerPrice.serviceId,
          services.map((s) => s.id),
        ),
      ),
    );

  const byService = new Map<string, { usd: string | null; aed: string | null; local: string | null }>();
  for (const row of prices) {
    const current = byService.get(row.serviceId) ?? { usd: null, aed: null, local: null };
    const minor = toMinorString(row.amountMinor);
    if (row.currency === "USD") current.usd = minor;
    else if (row.currency === "AED") current.aed = minor;
    else if (row.currency === currencyCode) current.local = minor;
    byService.set(row.serviceId, current);
  }

  return services.map((s) => {
    const price = byService.get(s.id) ?? { usd: null, aed: null, local: null };
    return {
      serviceId: s.id,
      serviceName: s.name,
      enabled: s.enabled,
      usdMinor: price.usd,
      aedMinor: price.aed,
      localMinor: price.local,
    };
  });
};

const uniqueNationalityCodes = (codes: string[]): string[] => [
  ...new Set(codes.map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c))),
];

const assertNationalitiesExist = async (tx: DbTransaction, codes: string[]): Promise<void> => {
  const rows = await tx
    .select({ code: schema.nationality.code })
    .from(schema.nationality)
    .where(inArray(schema.nationality.code, codes));
  if (rows.length !== codes.length) {
    throw new LocalCurrencyAdminError("One or more nationalities were not found.", "VALIDATION");
  }
};

const replaceNationalityLinks = async (
  tx: DbTransaction,
  currencyCode: string,
  nationalityCodes: string[],
): Promise<void> => {
  await tx
    .delete(schema.catalogCurrencyNationality)
    .where(eq(schema.catalogCurrencyNationality.currencyCode, currencyCode));
  if (nationalityCodes.length === 0) return;
  await tx.insert(schema.catalogCurrencyNationality).values(
    nationalityCodes.map((nationalityCode) => ({
      currencyCode,
      nationalityCode,
    })),
  );
};
