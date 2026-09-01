/** Google Ads Checkout Completed event — AW-17767633830/THfyCPCPh-wcEKanophC */
export const DEFAULT_GADS_CHECKOUT_CONVERSION_SEND_TO = "AW-17767633830/THfyCPCPh-wcEKanophC";

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

export const buildGadsCheckoutConversionParams = (
  input: TGadsCheckoutConversionInput,
  sendTo = getGadsCheckoutConversionSendTo(),
): TGadsCheckoutConversionParams | null => {
  const transactionId = input.transactionId.trim();
  if (!sendTo || !transactionId) return null;
  return {
    send_to: sendTo,
    value: input.value ?? 1.0,
    currency: input.currency ?? "AED",
    transaction_id: transactionId,
  };
};
