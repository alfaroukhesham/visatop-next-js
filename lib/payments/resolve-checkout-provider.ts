import type { DbTransaction } from "@/lib/db";
import { resolveCheckoutTotal } from "@/lib/pricing/resolve-customer-catalog-price";
import type { TUsdAedCurrency } from "@/lib/pricing/catalog-currency";
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
  quoteCurrency: TUsdAedCurrency | "NGN";
  /** True when NG + flag on, but no stored NGN row so we use the default provider. */
  fincraSkippedMissingNgn: boolean;
};

export const resolveCheckoutProviderDecision = (params: {
  nationalityCode: string;
  hasStoredNgnPriceForEveryMember: boolean;
  displayCurrency: TUsdAedCurrency;
  defaultProvider?: ActivePaymentProvider;
  fincraEnabled?: boolean;
}): TCheckoutProviderDecision => {
  const defaultProvider = params.defaultProvider ?? getActivePaymentProvider();
  const fincraEnabled = params.fincraEnabled ?? isFincraEnabled();
  if (
    fincraEnabled &&
    isFincraNationality(params.nationalityCode) &&
    params.hasStoredNgnPriceForEveryMember
  ) {
    return { provider: "fincra", quoteCurrency: "NGN", fincraSkippedMissingNgn: false };
  }
  return {
    provider: defaultProvider,
    quoteCurrency: params.displayCurrency,
    fincraSkippedMissingNgn:
      fincraEnabled && isFincraNationality(params.nationalityCode) && !params.hasStoredNgnPriceForEveryMember,
  };
};

export const membersHaveStoredNgnPrices = async (
  tx: DbTransaction,
  members: Array<{ nationalityCode: string; serviceId: string }>,
): Promise<boolean> => {
  if (members.length === 0) return false;
  for (const member of members) {
    const price = await resolveCheckoutTotal(tx, {
      nationalityCode: member.nationalityCode,
      serviceId: member.serviceId,
      catalogCurrency: "NGN",
    });
    if (!price || price.wasFxDerived) return false;
  }
  return true;
};
