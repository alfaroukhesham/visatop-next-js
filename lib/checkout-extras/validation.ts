import { z } from "zod";
import { parseAdminPriceMajorInput } from "@/lib/admin/catalog/parse-admin-price-input";
import { wholeUnitPriceMessage } from "@/lib/checkout-extras/whole-unit";
import { FALLBACK_CUSTOMER_LOCALE_SLUGS } from "@/lib/i18n/customer-locale";
import { ADMIN_IMPORT_CURRENCIES } from "@/lib/payments/local-checkout-config";
import { CHECKOUT_EXTRA_KEYS, type TCheckoutExtraKey } from "@/lib/db/schema/checkout-extra";
import type { TCheckoutExtraWrite } from "@/lib/checkout-extras/types";

export const CHECKOUT_EXTRA_CURRENCIES = ADMIN_IMPORT_CURRENCIES;

const LABEL_MAX = 80;
const DESCRIPTION_MAX = 400;
const PROMISE_MAX = 200;
const TERMS_URL_MAX = 500;

const localeSlugSet = new Set<string>(FALLBACK_CUSTOMER_LOCALE_SLUGS);
const currencySet = new Set<string>(CHECKOUT_EXTRA_CURRENCIES);

export const checkoutExtraWriteBodySchema = z.object({
  enabled: z.boolean(),
  baseCurrency: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase()),
  baseAmountMajor: z.string().trim().min(1).max(20),
  labels: z.record(z.string(), z.string().max(LABEL_MAX)),
  descriptions: z.record(z.string(), z.string().max(DESCRIPTION_MAX)),
  promise: z.record(z.string(), z.string().max(PROMISE_MAX)).nullable(),
  termsUrl: z.string().trim().max(TERMS_URL_MAX).nullable(),
  prices: z
    .array(
      z.object({
        currency: z
          .string()
          .trim()
          .transform((value) => value.toUpperCase()),
        amountMajor: z.string().trim().max(20),
      }),
    )
    .max(CHECKOUT_EXTRA_CURRENCIES.length),
});

export type TCheckoutExtraWriteBody = z.infer<typeof checkoutExtraWriteBodySchema>;

export type TPrepareCheckoutExtraResult =
  | { ok: true; value: TCheckoutExtraWrite }
  | { ok: false; message: string };

const compactLocaleMap = (
  input: Record<string, string>,
  max: number,
): { ok: true; value: Record<string, string> } | { ok: false; message: string } => {
  const value: Record<string, string> = {};
  for (const [rawSlug, rawText] of Object.entries(input)) {
    const slug = rawSlug.trim().toLowerCase();
    if (!localeSlugSet.has(slug)) {
      return { ok: false, message: `Unknown language "${rawSlug}".` };
    }
    const text = rawText.trim();
    if (!text) continue;
    if (text.length > max) {
      return { ok: false, message: `Text for ${slug} is too long.` };
    }
    value[slug] = text;
  }
  return { ok: true, value };
};

const parseTermsUrl = (raw: string | null): { ok: true; value: string | null } | { ok: false; message: string } => {
  if (raw === null) return { ok: true, value: null };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: "Terms link must be an http or https URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, message: "Terms link must be an http or https URL." };
  }
  return { ok: true, value: url.toString() };
};

export type TCheckoutExtraFieldError = {
  field: string;
  message: string;
};

const minorFromMajor = (
  amountMajor: string,
  label: string,
  currency?: string,
): { ok: true; value: number } | { ok: false; message: string } => {
  const minor = parseAdminPriceMajorInput(amountMajor);
  if (minor === null || minor <= BigInt(0)) {
    return { ok: false, message: `${label} must be a positive amount.` };
  }
  if (currency) {
    const whole = wholeUnitPriceMessage(amountMajor, currency);
    if (whole) return { ok: false, message: whole };
  }
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, message: `${label} is too large.` };
  }
  return { ok: true, value: Number(minor) };
};

/** Every invalid price, in form order, so the admin UI can mark each field. */
export const listCheckoutExtraFieldErrors = (
  body: TCheckoutExtraWriteBody,
): TCheckoutExtraFieldError[] => {
  const errors: TCheckoutExtraFieldError[] = [];
  if (body.baseAmountMajor.trim()) {
    const base = minorFromMajor(body.baseAmountMajor, "Base price", body.baseCurrency);
    if (!base.ok) errors.push({ field: "baseAmount", message: base.message });
  }
  const seen = new Set<string>();
  for (const price of body.prices) {
    const currency = price.currency;
    if (!currency || seen.has(currency) || !price.amountMajor) continue;
    seen.add(currency);
    const amount = minorFromMajor(price.amountMajor, `${currency} price`, currency);
    if (!amount.ok) errors.push({ field: `price:${currency}`, message: amount.message });
  }
  return errors;
};

export const prepareCheckoutExtraWrite = (
  key: TCheckoutExtraKey,
  body: TCheckoutExtraWriteBody,
): TPrepareCheckoutExtraResult => {
  if (!currencySet.has(body.baseCurrency)) {
    return { ok: false, message: "Base currency must be USD, AED, or a configured local currency." };
  }

  const baseAmount = minorFromMajor(body.baseAmountMajor, "Base price", body.baseCurrency);
  if (!baseAmount.ok) return baseAmount;

  const labels = compactLocaleMap(body.labels, LABEL_MAX);
  if (!labels.ok) return labels;
  if (!labels.value.en) {
    return { ok: false, message: "English label is required." };
  }

  const descriptions = compactLocaleMap(body.descriptions, DESCRIPTION_MAX);
  if (!descriptions.ok) return descriptions;

  let promiseI18n: Record<string, string> | null = null;
  if (key === "fast_track") {
    const promise = compactLocaleMap(body.promise ?? {}, PROMISE_MAX);
    if (!promise.ok) return promise;
    if (!promise.value.en) {
      return { ok: false, message: "English Fast Track promise is required." };
    }
    promiseI18n = promise.value;
  } else if (body.promise && Object.values(body.promise).some((text) => text.trim() !== "")) {
    return { ok: false, message: "Promise text is only used for Fast Track." };
  }

  const termsUrl = parseTermsUrl(body.termsUrl);
  if (!termsUrl.ok) return termsUrl;

  const prices: TCheckoutExtraWrite["prices"] = [];
  const seen = new Set<string>();
  for (const price of body.prices) {
    if (!currencySet.has(price.currency)) {
      return { ok: false, message: `${price.currency} is not a checkout currency.` };
    }
    if (seen.has(price.currency)) {
      return { ok: false, message: `Duplicate price for ${price.currency}.` };
    }
    seen.add(price.currency);
    if (!price.amountMajor) continue;
    const amount = minorFromMajor(price.amountMajor, `${price.currency} price`, price.currency);
    if (!amount.ok) return amount;
    prices.push({ currency: price.currency, amountMinor: amount.value });
  }

  return {
    ok: true,
    value: {
      enabled: body.enabled,
      baseCurrency: body.baseCurrency,
      baseAmountMinor: baseAmount.value,
      labelI18n: labels.value,
      descriptionI18n: descriptions.value,
      promiseI18n,
      termsUrl: termsUrl.value,
      prices,
    },
  };
};

export const isCheckoutExtraKey = (value: string): value is TCheckoutExtraKey =>
  (CHECKOUT_EXTRA_KEYS as readonly string[]).includes(value);

export const PLATFORM_KEY_FAST_TRACK_THRESHOLD_DAYS = "fast_track_threshold_days";
export const PLATFORM_KEY_TRAVEL_DATE_REQUIRED = "travel_date_required";
export const PLATFORM_KEY_TRAVEL_DATE_MAX_DAYS_AHEAD = "travel_date_max_days_ahead";

export const DEFAULT_FAST_TRACK_THRESHOLD_DAYS = 4;
export const DEFAULT_TRAVEL_DATE_REQUIRED = true;
export const DEFAULT_TRAVEL_DATE_MAX_DAYS_AHEAD = 180;

export const FAST_TRACK_THRESHOLD_MIN = 1;
export const FAST_TRACK_THRESHOLD_MAX = 60;
export const TRAVEL_DATE_MAX_DAYS_AHEAD_MIN = 1;
export const TRAVEL_DATE_MAX_DAYS_AHEAD_MAX = 730;

const parseBoundedInt = (
  value: string | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number => {
  if (value === undefined || value === null) return fallback;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return fallback;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
};

export const parseFastTrackThresholdDays = (value: string | null | undefined): number =>
  parseBoundedInt(
    value,
    FAST_TRACK_THRESHOLD_MIN,
    FAST_TRACK_THRESHOLD_MAX,
    DEFAULT_FAST_TRACK_THRESHOLD_DAYS,
  );

export const parseTravelDateRequired = (value: string | null | undefined): boolean => {
  if (value === undefined || value === null || value.trim() === "") return DEFAULT_TRAVEL_DATE_REQUIRED;
  if (value === "true") return true;
  if (value === "false") return false;
  return DEFAULT_TRAVEL_DATE_REQUIRED;
};

export const parseTravelDateMaxDaysAhead = (value: string | null | undefined): number =>
  parseBoundedInt(
    value,
    TRAVEL_DATE_MAX_DAYS_AHEAD_MIN,
    TRAVEL_DATE_MAX_DAYS_AHEAD_MAX,
    DEFAULT_TRAVEL_DATE_MAX_DAYS_AHEAD,
  );

export const travelDateSettingsErrorMessage = (error: {
  issues: readonly { code: string; path: readonly PropertyKey[]; message: string }[];
}): string => {
  const issue = error.issues[0];
  if (!issue) return "Check the travel date settings and try again.";
  if (issue.code === "custom") return issue.message;
  const field = issue.path[0];
  if (field === "fastTrackThresholdDays") {
    return "Fast Track threshold must be a whole number from 1 to 60.";
  }
  if (field === "travelDateMaxDaysAhead") {
    return "Maximum days ahead must be a whole number from 1 to 730.";
  }
  if (field === "travelDateRequired") {
    return "Require a travel date must be yes or no.";
  }
  return issue.message || "Check the travel date settings and try again.";
};

export const travelDateSettingsWriteSchema = z
  .object({
    fastTrackThresholdDays: z
      .number()
      .int()
      .min(FAST_TRACK_THRESHOLD_MIN)
      .max(FAST_TRACK_THRESHOLD_MAX),
    travelDateRequired: z.boolean(),
    travelDateMaxDaysAhead: z
      .number()
      .int()
      .min(TRAVEL_DATE_MAX_DAYS_AHEAD_MIN)
      .max(TRAVEL_DATE_MAX_DAYS_AHEAD_MAX),
  })
  .refine((value) => value.fastTrackThresholdDays <= value.travelDateMaxDaysAhead, {
    message: "Fast Track threshold cannot be greater than the maximum days ahead.",
    path: ["fastTrackThresholdDays"],
  });
