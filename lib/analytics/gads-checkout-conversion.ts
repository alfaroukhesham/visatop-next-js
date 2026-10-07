/** Google Ads Checkout Completed event — AW-17767633830/THfyCPCPh-wcEKanophC */
export const DEFAULT_GADS_CHECKOUT_CONVERSION_SEND_TO = "AW-17767633830/THfyCPCPh-wcEKanophC";

export const GADS_CHECKOUT_CONVERSION_STORAGE_PREFIX = "vt_gads_checkout:";

export type TGadsCheckoutConversionParams = {
  send_to: string;
  value: number;
  currency: string;
  transaction_id: string;
};

export type TGadsCheckoutConversionInput = {
  transactionId: string;
  value?: number;
  currency?: string;
};

/** Empty string disables the Checkout Completed conversion. */
export const getGadsCheckoutConversionSendTo = (): string => {
  const raw = process.env.NEXT_PUBLIC_GADS_CHECKOUT_CONVERSION_SEND_TO;
  if (raw === "") return "";
  return raw?.trim() || DEFAULT_GADS_CHECKOUT_CONVERSION_SEND_TO;
};

export const gadsCheckoutConversionStorageKey = (transactionId: string): string =>
  `${GADS_CHECKOUT_CONVERSION_STORAGE_PREFIX}${transactionId}`;

const claimedGadsCheckoutConversions = new Set<string>();

export const resetGadsCheckoutConversionClaims = (): void => {
  claimedGadsCheckoutConversions.clear();
  if (typeof sessionStorage === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(GADS_CHECKOUT_CONVERSION_STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    /* private mode */
  }
};

/** Once per transaction id for this tab (sessionStorage + memory). */
export const claimGadsCheckoutConversionOnce = (transactionId: string): boolean => {
  const key = gadsCheckoutConversionStorageKey(transactionId);
  if (claimedGadsCheckoutConversions.has(key)) return false;
  if (typeof sessionStorage !== "undefined") {
    try {
      if (sessionStorage.getItem(key)) {
        claimedGadsCheckoutConversions.add(key);
        return false;
      }
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode — memory still dedupes this JS context */
    }
  }
  claimedGadsCheckoutConversions.add(key);
  return true;
};

/**
 * Checkout Completed payload. Requires the charged amount and currency — never
 * invents `1.0` / `AED`. Matches GA4 `purchase` `transaction_id` / value / currency.
 */
export const buildGadsCheckoutConversionParams = (
  input: TGadsCheckoutConversionInput,
  sendTo = getGadsCheckoutConversionSendTo(),
): TGadsCheckoutConversionParams | null => {
  const transactionId = input.transactionId.trim();
  const currency = input.currency?.trim().toUpperCase() ?? "";
  if (!sendTo || !transactionId || !currency) return null;
  if (input.value === undefined || !Number.isFinite(input.value) || input.value < 0) {
    return null;
  }
  return {
    send_to: sendTo,
    value: input.value,
    currency,
    transaction_id: transactionId,
  };
};
