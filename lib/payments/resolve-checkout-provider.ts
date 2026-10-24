import type { DbTransaction } from "@/lib/db";
import { loadVisibleCatalogCurrencies } from "@/lib/catalog/load-visible-catalog-currencies";
import { resolveCheckoutTotal } from "@/lib/pricing/resolve-customer-catalog-price";
import {
  FINCRA_CURRENCY,
  parseUsdAedCurrency,
  type TUsdAedCurrency,
} from "@/lib/pricing/catalog-currency";
import {
  assertSelectedCatalogCurrency,
  type TSelectedCurrencyFailureReason,
  type TVisibleCatalogCurrency,
} from "@/lib/catalog/local-currency";
import {
  getActivePaymentProvider,
  isFincraEnabled,
  type ActivePaymentProvider,
  type CheckoutPaymentProvider,
} from "@/lib/payments/resolve-payment-provider";

export const FINCRA_NATIONALITY_CODE = "NG";

export const isFincraNationality = (nationalityCode: string): boolean =>
  nationalityCode.trim().toUpperCase() === FINCRA_NATIONALITY_CODE;

export type TCheckoutProviderDecision = {
  provider: CheckoutPaymentProvider;
  quoteCurrency: TUsdAedCurrency | typeof FINCRA_CURRENCY;
  /** True when NG + flag on, but no stored NGN row so we use the default provider. */
  fincraSkippedMissingNgn: boolean;
};

export const resolveCheckoutProviderDecision = (params: {
  nationalityCode: string;
  hasStoredNgnPriceForEveryMember: boolean;
  displayCurrency: TUsdAedCurrency;
  /** Draft/selected catalog currency. NGN selects Fincra when the other gates pass. */
  selectedCurrency?: string;
  defaultProvider?: ActivePaymentProvider;
  fincraEnabled?: boolean;
}): TCheckoutProviderDecision => {
  const defaultProvider = params.defaultProvider ?? getActivePaymentProvider();
  const fincraEnabled = params.fincraEnabled ?? isFincraEnabled();
  const selectedNgn = (params.selectedCurrency ?? "").trim().toUpperCase() === FINCRA_CURRENCY;
  if (
    selectedNgn &&
    fincraEnabled &&
    isFincraNationality(params.nationalityCode) &&
    params.hasStoredNgnPriceForEveryMember
  ) {
    return { provider: "fincra", quoteCurrency: FINCRA_CURRENCY, fincraSkippedMissingNgn: false };
  }
  return {
    provider: defaultProvider,
    quoteCurrency: params.displayCurrency,
    fincraSkippedMissingNgn:
      selectedNgn &&
      fincraEnabled &&
      isFincraNationality(params.nationalityCode) &&
      !params.hasStoredNgnPriceForEveryMember,
  };
};

export const membersHaveStoredPricesInCurrency = async (
  tx: DbTransaction,
  members: Array<{ nationalityCode: string; serviceId: string }>,
  catalogCurrency: string,
): Promise<boolean> => {
  if (members.length === 0) return false;
  for (const member of members) {
    const price = await resolveCheckoutTotal(tx, {
      nationalityCode: member.nationalityCode,
      serviceId: member.serviceId,
      catalogCurrency,
    });
    if (!price || price.wasFxDerived) return false;
  }
  return true;
};

export const membersHaveStoredNgnPrices = (
  tx: DbTransaction,
  members: Array<{ nationalityCode: string; serviceId: string }>,
): Promise<boolean> => membersHaveStoredPricesInCurrency(tx, members, FINCRA_CURRENCY);

export const decideCheckoutProviderFromContext = (params: {
  nationalityCode: string;
  selectedCurrency: string;
  visible: TVisibleCatalogCurrency[];
  hasStoredPriceForSelected: boolean;
  defaultProvider?: ActivePaymentProvider;
  fincraEnabled?: boolean;
}): { ok: true; decision: TCheckoutProviderDecision } | { ok: false; reason: TSelectedCurrencyFailureReason } => {
  const selected = params.selectedCurrency.trim().toUpperCase();
  const access = assertSelectedCatalogCurrency({
    selected,
    visible: params.visible,
    hasStoredPrice: params.hasStoredPriceForSelected,
  });
  if (!access.ok) return { ok: false, reason: access.reason };
  const decision = resolveCheckoutProviderDecision({
    nationalityCode: params.nationalityCode,
    hasStoredNgnPriceForEveryMember:
      access.kind === "local" && access.currency === FINCRA_CURRENCY
        ? params.hasStoredPriceForSelected
        : false,
    displayCurrency: parseUsdAedCurrency(access.currency),
    selectedCurrency: access.currency,
    defaultProvider: params.defaultProvider,
    fincraEnabled: params.fincraEnabled,
  });
  return { ok: true, decision };
};

export const resolveCheckoutOfferDecision = async (
  tx: DbTransaction,
  params: {
    nationalityCode: string;
    selectedCurrency: string;
    members: Array<{ nationalityCode: string; serviceId: string }>;
    defaultProvider?: ActivePaymentProvider;
    fincraEnabled?: boolean;
  },
): Promise<
  | { ok: true; decision: TCheckoutProviderDecision }
  | { ok: false; reason: TSelectedCurrencyFailureReason }
> => {
  const selected = params.selectedCurrency.trim().toUpperCase();
  const visible = await loadVisibleCatalogCurrencies(tx, params.nationalityCode);
  const kind = visible.find((c) => c.code === selected)?.kind;
  const hasStoredPriceForSelected =
    kind === "local"
      ? await membersHaveStoredPricesInCurrency(tx, params.members, selected)
      : true;
  return decideCheckoutProviderFromContext({
    nationalityCode: params.nationalityCode,
    selectedCurrency: selected,
    visible,
    hasStoredPriceForSelected,
    defaultProvider: params.defaultProvider,
    fincraEnabled: params.fincraEnabled,
  });
};
