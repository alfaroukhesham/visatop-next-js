export type TCheckoutRecapTotal = {
  applicationId: string;
  value: number;
  currency: string;
  nationality?: string;
  serviceId?: string;
};

let lastRecap: TCheckoutRecapTotal | null = null;

export const rememberCheckoutRecapTotal = (input: TCheckoutRecapTotal): void => {
  const applicationId = input.applicationId.trim();
  const currency = input.currency.trim().toUpperCase();
  if (!applicationId || !currency || !Number.isFinite(input.value)) return;
  lastRecap = {
    applicationId,
    value: input.value,
    currency,
    ...(input.nationality?.trim()
      ? { nationality: input.nationality.trim().toUpperCase() }
      : {}),
    ...(input.serviceId?.trim() ? { serviceId: input.serviceId.trim() } : {}),
  };
};

export const checkoutRecapTotalFor = (applicationId: string): TCheckoutRecapTotal | null => {
  if (!lastRecap || lastRecap.applicationId !== applicationId) return null;
  return lastRecap;
};

export const resetCheckoutRecapTotal = (): void => {
  lastRecap = null;
};
