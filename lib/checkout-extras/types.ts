import type { TCheckoutChargeBasis, TCheckoutExtraKey } from "@/lib/db/schema/checkout-extra";

export type { TCheckoutChargeBasis, TCheckoutExtraKey };

export type TCheckoutExtraPriceAdmin = {
  currency: string;
  amountMinor: number;
  amountMajor: string;
};

export type TCheckoutExtraAdmin = {
  key: TCheckoutExtraKey;
  enabled: boolean;
  chargeBasis: TCheckoutChargeBasis;
  baseCurrency: string;
  baseAmountMinor: number;
  baseAmountMajor: string;
  labels: Record<string, string>;
  descriptions: Record<string, string>;
  promise: Record<string, string> | null;
  termsUrl: string | null;
  sortOrder: number;
  prices: TCheckoutExtraPriceAdmin[];
};

export type TCheckoutExtraPriceWrite = {
  currency: string;
  amountMinor: number;
};

export type TCheckoutExtraWrite = {
  enabled: boolean;
  baseCurrency: string;
  baseAmountMinor: number;
  labelI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  promiseI18n: Record<string, string> | null;
  termsUrl: string | null;
  prices: TCheckoutExtraPriceWrite[];
};

export type TTravelDateSettings = {
  fastTrackThresholdDays: number;
  travelDateRequired: boolean;
  travelDateMaxDaysAhead: number;
};
