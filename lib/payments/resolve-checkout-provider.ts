import type { DbTransaction } from "@/lib/db";
import { loadVisibleCatalogCurrencies } from "@/lib/catalog/load-visible-catalog-currencies";
import { resolveCheckoutTotal } from "@/lib/pricing/resolve-customer-catalog-price";
import { parseQuoteCurrency } from "@/lib/pricing/catalog-currency";
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
import { getLocalCheckoutForSelection } from "@/lib/payments/local-checkout-config";

export type TCheckoutProviderDecision = {
  provider: CheckoutPaymentProvider;
  quoteCurrency: string;
  /** True when a configured local currency is selected but stored prices are missing. */
  fincraSkippedMissingLocalPrice: boolean;
};

export const resolveCheckoutProviderDecision = (params: {
  nationalityCode: string;
  hasStoredLocalPriceForEveryMember: boolean;
  displayCurrency: string;
  /** Draft/selected catalog currency. */
  selectedCurrency?: string;
  defaultProvider?: ActivePaymentProvider;
  fincraEnabled?: boolean;
}): TCheckoutProviderDecision => {
  const defaultProvider = params.defaultProvider ?? getActivePaymentProvider();
  const fincraEnabled = params.fincraEnabled ?? isFincraEnabled();
  const selected = (params.selectedCurrency ?? "").trim().toUpperCase();
  const localEntry = getLocalCheckoutForSelection(params.nationalityCode, selected);
  if (
    localEntry &&
    localEntry.provider === "fincra" &&
    fincraEnabled &&
    params.hasStoredLocalPriceForEveryMember
  ) {
    return {
      provider: "fincra",
      quoteCurrency: localEntry.currency,
      fincraSkippedMissingLocalPrice: false,
    };
  }
  return {
    provider: defaultProvider,
    quoteCurrency: params.displayCurrency,
    fincraSkippedMissingLocalPrice: Boolean(
      localEntry &&
        localEntry.provider === "fincra" &&
        fincraEnabled &&
        !params.hasStoredLocalPriceForEveryMember,
    ),
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
  const localEntry = getLocalCheckoutForSelection(params.nationalityCode, access.currency);
  const decision = resolveCheckoutProviderDecision({
    nationalityCode: params.nationalityCode,
    hasStoredLocalPriceForEveryMember:
      access.kind === "local" && localEntry
        ? params.hasStoredPriceForSelected
        : false,
    displayCurrency: parseQuoteCurrency(access.currency),
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