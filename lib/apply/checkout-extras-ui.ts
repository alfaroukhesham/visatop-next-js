import { isRealIsoDate } from "@/lib/checkout-extras/dubai-calendar";
import type { TCustomerMessageVars } from "@/lib/i18n/customer-messages";

export type TTranslate = (key: string, vars?: TCustomerMessageVars) => string;

export type TTravelWindow = {
  todayUae: string;
  maxTravelDate: string;
  extrasActive: boolean;
  showTravelDateStep: boolean;
  travelDateRequired: boolean;
  fastTrackThresholdDays: number;
};

export type TProcessingSpeedChoice = "standard" | "fast_track";
export type TProcessingSpeedSourceChoice = "system" | "customer";
export type TCheckoutExtraKey = "fast_track" | "travel_insurance";

export type TClientAvailableExtra = {
  key: TCheckoutExtraKey;
  unitAmountMinor: string;
  travellerCount: number;
  sumAmountMinor: string;
  selected: boolean;
  chargeBasis: "per_traveller" | "per_order";
  labelI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  promiseI18n: Record<string, string> | null;
  termsUrl: string | null;
};

export type TClientQuotePreview = {
  currency: string;
  todayUae: string;
  maxTravelDate: string;
  travelDateRequired: boolean;
  thresholdDays: number;
  travelDate: string | null;
  daysUntilTravel: number | null;
  recommendFastTrack: boolean;
  processingSpeed: TProcessingSpeedChoice | null;
  processingSpeedSource: TProcessingSpeedSourceChoice | null;
  locked: boolean;
  travellerCount: number;
  visaLines: Array<{ applicationId: string; serviceId: string; amountMinor: string }>;
  extraLines: Array<{ key: TCheckoutExtraKey; applicationId: string | null; amountMinor: string }>;
  availableExtras: TClientAvailableExtra[];
  visaAmountMinor: string;
  extrasAmountMinor: string;
  totalAmountMinor: string;
  /** Stored insurance was dropped because it is disabled or unpriced. */
  insuranceRemoved?: boolean;
};

export type TTripInsuranceSelection = {
  applicationId: string;
  selected: boolean;
};

export type TTripPatchBody = {
  travelDate?: string | null;
  processingSpeed?: TProcessingSpeedChoice;
  /** Visa list only. The server rejects a speed change without this. */
  speedContext?: "visa-list";
  travelInsurance?: readonly TTripInsuranceSelection[];
  /** One insurance tickbox for the whole party. */
  insuranceForParty?: boolean;
};

export type TSpeedNote = "n1" | "n2" | "n3" | "n4" | "n5" | "soon";

export type TSpeedUi = {
  showRadios: boolean;
  selected: TProcessingSpeedChoice;
  badge: boolean;
  note: TSpeedNote | null;
};

export type TTripSaveOutcome =
  | { kind: "saved"; preview: TClientQuotePreview }
  | { kind: "locked" }
  | { kind: "failed"; messageKey: string }
  | { kind: "ignored" };

export const tripFailureMessageKey = (reason: string | undefined): string => {
  switch (reason) {
    case "travel_date_required":
      return "start.travelDate.errorEmpty";
    case "travel_date_past":
      return "start.travelDate.errorPast";
    case "travel_date_too_far":
      return "start.travelDate.errorMax";
    case "travel_date_invalid":
      return "start.travelDate.errorIncomplete";
    case "fast_track_unavailable":
      return "extras.error.fastTrackUnavailable";
    case "travel_insurance_unavailable":
      return "extras.error.insuranceUnavailable";
    case "speed_locked":
      return "extras.error.speedLocked";
    default:
      return "extras.error.update";
  }
};

export const reasonFromErrorDetails = (details: unknown): string | undefined => {
  if (!details || typeof details !== "object") return undefined;
  const reason = (details as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : undefined;
};

const MS_PER_DAY = 86_400_000;

export const calendarDaysBetween = (fromIso: string, toIso: string): number | null => {
  if (!isRealIsoDate(fromIso) || !isRealIsoDate(toIso)) return null;
  const [fromYear, fromMonth, fromDay] = fromIso.split("-").map((part) => Number(part));
  const [toYear, toMonth, toDay] = toIso.split("-").map((part) => Number(part));
  const fromUtc = Date.UTC(fromYear!, fromMonth! - 1, fromDay!);
  const toUtc = Date.UTC(toYear!, toMonth! - 1, toDay!);
  return Math.round((toUtc - fromUtc) / MS_PER_DAY);
};

const uiLocale = (locale: string): string => (locale === "en" ? "en-GB" : locale);

export const formatArrivalDate = (isoDate: string, locale: string): string => {
  if (!isRealIsoDate(isoDate)) return "";
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year!, month! - 1, day!, 12, 0, 0));
  return new Intl.DateTimeFormat(uiLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dubai",
    numberingSystem: "latn",
  }).format(date);
};

export const formatMinorAmount = (
  minor: string,
  currency: string,
  locale: string,
  display: "symbol" | "code",
): string => {
  const amount = Number(minor) / 100;
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(uiLocale(locale), {
      style: "currency",
      currency,
      currencyDisplay: display === "code" ? "code" : "symbol",
      numberingSystem: "latn",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

export const pluralMessage = (
  t: TTranslate,
  baseKey: string,
  locale: string,
  count: number,
  vars?: TCustomerMessageVars,
): string => {
  const suffix = new Intl.PluralRules(locale).select(count);
  const key = `${baseKey}_${suffix}`;
  const resolved = t(key, vars);
  if (resolved !== key) return resolved;
  return t(`${baseKey}_other`, vars);
};

export const relativeArrivalLabel = (locale: string, days: number, t: TTranslate): string => {
  if (days <= 0) return t("relative.today");
  if (days === 1) return t("relative.tomorrow");
  return pluralMessage(t, "relative.inDays", locale, days, { n: days });
};

export const arrivalReadback = (
  isoDate: string,
  todayUae: string,
  locale: string,
  t: TTranslate,
): string | null => {
  const days = calendarDaysBetween(todayUae, isoDate);
  if (days === null || days < 0) return null;
  return t("start.travelDate.readback", {
    date: formatArrivalDate(isoDate, locale),
    relative: relativeArrivalLabel(locale, days, t),
  });
};

export const travelDateErrorKey = (
  code: "required" | "invalid" | "past" | "too_far",
): string => {
  switch (code) {
    case "required":
      return "start.travelDate.errorEmpty";
    case "past":
      return "start.travelDate.errorPast";
    case "too_far":
      return "start.travelDate.errorMax";
    case "invalid":
      return "start.travelDate.errorIncomplete";
    default:
      return "start.travelDate.errorEmpty";
  }
};

export const localizedExtraCopy = (
  map: Record<string, string> | null | undefined,
  locale: string,
  fallback: string,
): string => {
  const local = map?.[locale]?.trim();
  if (local) return local;
  const english = map?.en?.trim();
  if (english) return english;
  return fallback;
};

export const extraByKey = (
  preview: TClientQuotePreview,
  key: TCheckoutExtraKey,
): TClientAvailableExtra | null => preview.availableExtras.find((extra) => extra.key === key) ?? null;

/** The pay-step extras block stays off the page when the quote offers nothing. */
export const extrasSectionVisible = (preview: TClientQuotePreview): boolean =>
  preview.availableExtras.some((extra) => extra.key === "fast_track" || extra.key === "travel_insurance");

export const speedUi = (input: {
  preview: Pick<
    TClientQuotePreview,
    "recommendFastTrack" | "daysUntilTravel" | "processingSpeed" | "processingSpeedSource"
  >;
  fastTrackAvailable: boolean;
  switchedBack: boolean;
}): TSpeedUi => {
  const customerChoseFast =
    input.preview.processingSpeed === "fast_track" && input.preview.processingSpeedSource === "customer";
  const selected: TProcessingSpeedChoice = customerChoseFast ? "fast_track" : "standard";
  const days = input.preview.daysUntilTravel;
  const under = input.preview.recommendFastTrack && days !== null;
  const todayOrTomorrow = days !== null && days <= 1;
  let note: TSpeedNote | null = null;
  if (!input.fastTrackAvailable) note = under ? "n4" : null;
  else if (todayOrTomorrow) note = "n3";
  else if (under && selected === "standard") note = "n2";
  else if (input.switchedBack) note = "n5";

  if (!input.fastTrackAvailable) {
    return { showRadios: false, selected: "standard", badge: false, note };
  }

  return {
    showRadios: true,
    selected,
    badge: under,
    note,
  };
};

export const didSwitchBackToStandard = (
  before: TClientQuotePreview,
  after: TClientQuotePreview,
): boolean =>
  before.processingSpeedSource !== "customer" &&
  before.processingSpeed === "fast_track" &&
  after.processingSpeed === "standard";

export const isExtrasLockedResponse = (status: number, code: string | undefined): boolean =>
  status === 409 || code === "CHECKOUT_FROZEN";

export const outcomeFromTripSave = (input: {
  aborted: boolean;
  ok: boolean;
  status: number;
  code?: string;
  reason?: string;
  preview?: TClientQuotePreview;
}): TTripSaveOutcome => {
  if (input.aborted) return { kind: "ignored" };
  if (input.ok && input.preview) return { kind: "saved", preview: input.preview };
  if (isExtrasLockedResponse(input.status, input.code)) return { kind: "locked" };
  return { kind: "failed", messageKey: tripFailureMessageKey(input.reason) };
};

export const optimisticPreview = (
  preview: TClientQuotePreview,
  patch: TTripPatchBody,
): TClientQuotePreview => {
  const next: TClientQuotePreview = {
    ...preview,
    availableExtras: preview.availableExtras.map((extra) => ({ ...extra })),
  };
  if (patch.travelDate !== undefined) next.travelDate = patch.travelDate;
  if (patch.processingSpeed) {
    next.processingSpeed = patch.processingSpeed;
    next.processingSpeedSource = "customer";
    next.availableExtras = next.availableExtras.map((extra) =>
      extra.key === "fast_track" ? { ...extra, selected: patch.processingSpeed === "fast_track" } : extra,
    );
  }
  if (patch.insuranceForParty !== undefined) {
    const memberIds = next.visaLines.map((line) => line.applicationId);
    return applyInsuranceSelection(
      next,
      memberIds.map((applicationId) => ({
        applicationId,
        selected: patch.insuranceForParty === true,
      })),
    );
  }
  if (patch.travelInsurance !== undefined) {
    return applyInsuranceSelection(next, patch.travelInsurance);
  }
  return next;
};

export const insuredApplicationIds = (
  preview: Pick<TClientQuotePreview, "extraLines">,
): string[] =>
  preview.extraLines.flatMap((line) =>
    line.key === "travel_insurance" && line.applicationId ? [line.applicationId] : [],
  );

/** Optimistic per-traveller insurance total: insured count × unit price. Fast Track lines stay party-wide. */
export const applyInsuranceSelection = (
  preview: TClientQuotePreview,
  selections: readonly TTripInsuranceSelection[],
): TClientQuotePreview => {
  const insurance = extraByKey(preview, "travel_insurance");
  const unit = insurance ? BigInt(insurance.unitAmountMinor) : BigInt(0);
  const chosen = new Map(selections.map((row) => [row.applicationId, row.selected]));
  const memberIds = preview.visaLines.map((line) => line.applicationId);
  const selectedIds = memberIds.filter((id) => chosen.get(id) === true);
  const insuranceLines = selectedIds.map((applicationId) => ({
    key: "travel_insurance" as const,
    applicationId,
    amountMinor: unit.toString(),
  }));
  const extraLines = [
    ...preview.extraLines.filter((line) => line.key !== "travel_insurance"),
    ...insuranceLines,
  ];
  const extrasAmountMinor = extraLines.reduce((sum, line) => sum + BigInt(line.amountMinor), BigInt(0));
  const totalAmountMinor = BigInt(preview.visaAmountMinor) + extrasAmountMinor;
  const allSelected = memberIds.length > 0 && selectedIds.length === memberIds.length;
  return {
    ...preview,
    extraLines,
    extrasAmountMinor: extrasAmountMinor.toString(),
    totalAmountMinor: totalAmountMinor.toString(),
    availableExtras: preview.availableExtras.map((extra) =>
      extra.key === "travel_insurance" ? { ...extra, selected: allSelected } : extra,
    ),
  };
};

export const groupedExtraLines = (
  preview: Pick<TClientQuotePreview, "extraLines">,
): Array<{ key: TCheckoutExtraKey; amountMinor: string; count: number }> => {
  const order: TCheckoutExtraKey[] = ["fast_track", "travel_insurance"];
  const groups = new Map<TCheckoutExtraKey, { amount: bigint; count: number }>();
  for (const line of preview.extraLines) {
    const current = groups.get(line.key) ?? { amount: BigInt(0), count: 0 };
    current.amount += BigInt(line.amountMinor);
    current.count += 1;
    groups.set(line.key, current);
  }
  return order.flatMap((key) => {
    const group = groups.get(key);
    if (!group || group.amount <= BigInt(0)) return [];
    return [{ key, amountMinor: group.amount.toString(), count: group.count }];
  });
};

export const extraPriceSignature = (preview: TClientQuotePreview): string =>
  preview.availableExtras
    .map((extra) => `${extra.key}:${extra.unitAmountMinor}`)
    .sort()
    .join("|");

export const quoteUsesCodeFormat = (preview: TClientQuotePreview): boolean =>
  extrasSectionVisible(preview) || preview.extraLines.length > 0;

/** Customer link only. Empty and placeholder catalog values stay stored for a later real page. */
export const visibleInsuranceTermsUrl = (raw: string | null | undefined): string | null => {
  const url = raw?.trim() ?? "";
  if (!url || url.toLowerCase().includes("placeholder")) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return url;
};
