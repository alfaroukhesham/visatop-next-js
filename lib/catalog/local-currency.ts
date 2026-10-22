export type TCatalogCurrencyKind = "global" | "local";

export type TVisibleCatalogCurrency = {
  code: string;
  kind: TCatalogCurrencyKind;
};

export type TCatalogCurrencyRow = {
  code: string;
  kind: string;
  enabled: boolean;
};

export type TCatalogCurrencyLinkRow = {
  currencyCode: string;
  nationalityCode: string;
};

export type TSelectedCurrencyFailureReason = "invalid_code" | "not_visible" | "missing_stored_price";

export type TSelectedCurrencyResult =
  | { ok: true; currency: string; kind: TCatalogCurrencyKind }
  | { ok: false; reason: TSelectedCurrencyFailureReason };

const ISO_4217 = /^[A-Z]{3}$/;
const KIND_GLOBAL = "global";
const KIND_LOCAL = "local";

export const isIso4217CurrencyCode = (value: string): boolean => ISO_4217.test(value);

export const normalizeCurrencyCode = (raw: string | null | undefined): string | null => {
  const code = raw?.trim().toUpperCase() ?? "";
  return isIso4217CurrencyCode(code) ? code : null;
};

const isKind = (value: string): value is TCatalogCurrencyKind =>
  value === KIND_GLOBAL || value === KIND_LOCAL;

export const visibleCurrenciesForNationality = (
  currencies: TCatalogCurrencyRow[],
  links: TCatalogCurrencyLinkRow[],
  nationalityCode: string,
): TVisibleCatalogCurrency[] => {
  const nat = nationalityCode.trim().toUpperCase();
  const linked = new Set(
    links
      .filter((l) => l.nationalityCode.trim().toUpperCase() === nat)
      .map((l) => l.currencyCode.trim().toUpperCase()),
  );
  const globals: TVisibleCatalogCurrency[] = [];
  const locals: TVisibleCatalogCurrency[] = [];
  for (const row of currencies) {
    if (!row.enabled) continue;
    const code = row.code.trim().toUpperCase();
    if (!isIso4217CurrencyCode(code) || !isKind(row.kind)) continue;
    if (row.kind === KIND_GLOBAL) globals.push({ code, kind: KIND_GLOBAL });
    else if (linked.has(code)) locals.push({ code, kind: KIND_LOCAL });
  }
  globals.sort((a, b) => a.code.localeCompare(b.code));
  locals.sort((a, b) => a.code.localeCompare(b.code));
  const usd = globals.filter((c) => c.code === "USD");
  const aed = globals.filter((c) => c.code === "AED");
  const otherGlobals = globals.filter((c) => c.code !== "USD" && c.code !== "AED");
  return [...usd, ...aed, ...otherGlobals, ...locals];
};

export const assertSelectedCatalogCurrency = (params: {
  selected: string;
  visible: TVisibleCatalogCurrency[];
  hasStoredPrice: boolean;
}): TSelectedCurrencyResult => {
  const currency = params.selected.trim().toUpperCase();
  if (!isIso4217CurrencyCode(currency)) {
    return { ok: false, reason: "invalid_code" };
  }
  const visible = params.visible.find((c) => c.code === currency);
  if (!visible) return { ok: false, reason: "not_visible" };
  if (visible.kind === KIND_LOCAL && !params.hasStoredPrice) {
    return { ok: false, reason: "missing_stored_price" };
  }
  return { ok: true, currency, kind: visible.kind };
};

export const resolvePublicCatalogCurrencyQuery = (params: {
  requested: string | null | undefined;
  visible: TVisibleCatalogCurrency[];
  localPricedServiceIds: string[];
  selectedServiceId?: string | null;
  restored?: string | null;
}): { ok: true; currency: string } | { ok: false; reason: "invalid" } => {
  const requested = params.requested?.trim().toUpperCase() ?? "";
  if (requested) {
    if (!params.visible.some((c) => c.code === requested)) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, currency: requested };
  }
  return {
    ok: true,
    currency: pickDefaultCatalogCurrency({
      visible: params.visible,
      localPricedServiceIds: params.localPricedServiceIds,
      selectedServiceId: params.selectedServiceId,
      restored: params.restored,
    }),
  };
};

export const pickDefaultCatalogCurrency = (params: {
  visible: TVisibleCatalogCurrency[];
  localPricedServiceIds: string[];
  selectedServiceId?: string | null;
  restored?: string | null;
}): string => {
  const visibleCodes = new Set(params.visible.map((c) => c.code));
  const restored = params.restored?.trim().toUpperCase() ?? "";
  if (restored && visibleCodes.has(restored)) return restored;

  const local = params.visible.find((c) => c.kind === "local");
  const priced = new Set(params.localPricedServiceIds);
  const selected = params.selectedServiceId?.trim() ?? "";
  const hasLocalPrice = selected ? priced.has(selected) : priced.size > 0;
  if (local && hasLocalPrice) return local.code;

  const usd = params.visible.find((c) => c.kind === "global" && c.code === "USD");
  if (usd) return usd.code;
  const global = params.visible.find((c) => c.kind === "global");
  return global?.code ?? "USD";
};
