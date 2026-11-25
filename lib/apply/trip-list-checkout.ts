export type TListProcessingSpeed = "standard" | "fast_track";

/** Once an application exists, the list total is the server quote (insurance included). */
export const tripListCheckoutMinor = (input: {
  hasApplication: boolean;
  quoteTotalAmountMinor: string | null;
  localMinor: number | null;
}): string | null => {
  if (input.hasApplication) {
    const quote = input.quoteTotalAmountMinor?.trim() ?? "";
    return quote.length > 0 ? quote : null;
  }
  return input.localMinor === null ? null : String(input.localMinor);
};

/**
 * A speed click drops the in-flight first preview. Load it again only when that
 * click had no stored quote, so a failed save cannot leave the list on Standard
 * while checkout still charges Fast Track.
 */
export const reloadQuoteAfterFailedSpeedPatch = (hasSavedQuote: boolean): boolean => !hasSavedQuote;

/** Keep the previous speed unless the visa-list PATCH succeeded. */
export const speedCommitFromPatch = (input: {
  previous: TListProcessingSpeed;
  requested: TListProcessingSpeed;
  ok: boolean;
}): TListProcessingSpeed => (input.ok ? input.requested : input.previous);

export const tripSpeedErrorMessage = (input: {
  status: number;
  code?: string;
  message?: string;
  lockedMessage: string;
  genericMessage: string;
}): string => {
  const locked =
    input.status === 409 || input.code === "EXTRAS_LOCKED" || input.code === "CHECKOUT_FROZEN";
  const message = input.message?.trim();
  if (message) return message;
  return locked ? input.lockedMessage : input.genericMessage;
};
