import { and, asc, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  application,
  applicationExtraSelection,
  applicationParty,
  checkoutExtra,
  checkoutExtraPrice,
  payment,
} from "@/lib/db/schema";
import type { TCheckoutExtraKey, TProcessingSpeed, TProcessingSpeedSource } from "@/lib/db/schema/checkout-extra";
import { getTravelDateSettingsFromTx } from "@/lib/checkout-extras/travel-date-settings";
import {
  daysUntilTravel,
  recommendFastTrack,
  travelDateErrorMessage,
  travelDateReason,
  travelDateWindow,
} from "@/lib/checkout-extras/dubai-calendar";
import {
  checkoutTravelDateError,
  nextProcessingSpeed,
  planTripUpdate,
  tripEditsLocked,
  type TOpenPaymentRow,
  type TTripPatch,
} from "@/lib/checkout-extras/trip-rules";
import { resolveCheckoutTotal } from "@/lib/pricing/resolve-customer-catalog-price";
import {
  availabilityForCurrency,
  buildCheckoutCharge,
  extraIsPriced,
  partySumMinor,
  resolveCheckoutExtras,
  type TCheckoutExtraCatalogItem,
  type TVisaChargeLine,
} from "@/lib/pricing/resolve-checkout-extras";

export type TCheckoutExtraCatalog = TCheckoutExtraCatalogItem & {
  labelI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  promiseI18n: Record<string, string> | null;
  termsUrl: string | null;
};

export type TAvailableExtraQuote = {
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

export type TQuotePreview = {
  currency: string;
  todayUae: string;
  maxTravelDate: string;
  travelDateRequired: boolean;
  thresholdDays: number;
  travelDate: string | null;
  daysUntilTravel: number | null;
  recommendFastTrack: boolean;
  processingSpeed: TProcessingSpeed | null;
  processingSpeedSource: TProcessingSpeedSource | null;
  locked: boolean;
  travellerCount: number;
  visaLines: Array<{ applicationId: string; serviceId: string; amountMinor: string }>;
  extraLines: Array<{ key: TCheckoutExtraKey; applicationId: string | null; amountMinor: string }>;
  availableExtras: TAvailableExtraQuote[];
  visaAmountMinor: string;
  extrasAmountMinor: string;
  totalAmountMinor: string;
};

export type TPartyMemberRow = {
  applicationId: string;
  serviceId: string;
  nationalityCode: string;
  paymentStatus: string;
  checkoutState: string | null;
};

export type TPartyTripState = {
  partyId: string | null;
  currency: string;
  travelDate: string | null;
  processingSpeed: TProcessingSpeed | null;
  processingSpeedSource: TProcessingSpeedSource | null;
  members: TPartyMemberRow[];
  insuranceSelectedByApplicationId: Record<string, boolean>;
  catalog: TCheckoutExtraCatalog[];
  openPayments: TOpenPaymentRow[];
};

const asSpeed = (value: string | null | undefined): TProcessingSpeed | null =>
  value === "standard" || value === "fast_track" ? value : null;

const asSource = (value: string | null | undefined): TProcessingSpeedSource | null =>
  value === "system" || value === "customer" ? value : null;

const asKey = (value: string): TCheckoutExtraKey | null =>
  value === "travel_insurance" || value === "fast_track" ? value : null;

const asLocaleMap = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, text] of Object.entries(value)) {
    if (typeof text === "string" && text.trim()) out[key] = text;
  }
  return out;
};

export const loadCheckoutExtraCatalog = async (tx: DbTransaction): Promise<TCheckoutExtraCatalog[]> => {
  const extras = await tx
    .select({
      id: checkoutExtra.id,
      key: checkoutExtra.key,
      enabled: checkoutExtra.enabled,
      chargeBasis: checkoutExtra.chargeBasis,
      labelI18n: checkoutExtra.labelI18n,
      descriptionI18n: checkoutExtra.descriptionI18n,
      promiseI18n: checkoutExtra.promiseI18n,
      termsUrl: checkoutExtra.termsUrl,
    })
    .from(checkoutExtra);
  if (extras.length === 0) return [];
  const prices = await tx
    .select({
      extraId: checkoutExtraPrice.extraId,
      currency: checkoutExtraPrice.currency,
      amountMinor: checkoutExtraPrice.amountMinor,
    })
    .from(checkoutExtraPrice)
    .where(
      inArray(
        checkoutExtraPrice.extraId,
        extras.map((extra) => extra.id),
      ),
    );

  return extras.flatMap((extra) => {
    const key = asKey(extra.key);
    if (!key) return [];
    return [
      {
        id: extra.id,
        key,
        enabled: extra.enabled,
        chargeBasis: extra.chargeBasis === "per_order" ? "per_order" : "per_traveller",
        prices: prices
          .filter((price) => price.extraId === extra.id)
          .map((price) => ({ currency: price.currency, amountMinor: price.amountMinor })),
        labelI18n: asLocaleMap(extra.labelI18n),
        descriptionI18n: asLocaleMap(extra.descriptionI18n),
        promiseI18n: extra.promiseI18n ? asLocaleMap(extra.promiseI18n) : null,
        termsUrl: extra.termsUrl,
      },
    ];
  });
};

export const loadPartyTripState = async (
  tx: DbTransaction,
  applicationId: string,
): Promise<TPartyTripState | null> => {
  const [requested] = await tx
    .select({
      id: application.id,
      partyId: application.partyId,
      serviceId: application.serviceId,
      nationalityCode: application.nationalityCode,
      catalogCurrency: application.catalogCurrency,
      paymentStatus: application.paymentStatus,
      checkoutState: application.checkoutState,
    })
    .from(application)
    .where(eq(application.id, applicationId))
    .limit(1);
  if (!requested) return null;

  const memberRows = requested.partyId
    ? await tx
        .select({
          applicationId: application.id,
          serviceId: application.serviceId,
          nationalityCode: application.nationalityCode,
          paymentStatus: application.paymentStatus,
          checkoutState: application.checkoutState,
        })
        .from(application)
        .where(eq(application.partyId, requested.partyId))
        .orderBy(asc(application.travelerIndex))
    : [
        {
          applicationId: requested.id,
          serviceId: requested.serviceId,
          nationalityCode: requested.nationalityCode,
          paymentStatus: requested.paymentStatus,
          checkoutState: requested.checkoutState,
        },
      ];

  const [party] = requested.partyId
    ? await tx
        .select({
          travelDate: applicationParty.travelDate,
          processingSpeed: applicationParty.processingSpeed,
          processingSpeedSource: applicationParty.processingSpeedSource,
          catalogCurrency: applicationParty.catalogCurrency,
        })
        .from(applicationParty)
        .where(eq(applicationParty.id, requested.partyId))
        .limit(1)
    : [];

  const catalog = await loadCheckoutExtraCatalog(tx);
  const insurance = catalog.find((extra) => extra.key === "travel_insurance");
  const memberIds = memberRows.map((member) => member.applicationId);
  const selectionRows =
    insurance && memberIds.length > 0
      ? await tx
          .select({
            applicationId: applicationExtraSelection.applicationId,
            selected: applicationExtraSelection.selected,
          })
          .from(applicationExtraSelection)
          .where(
            and(
              eq(applicationExtraSelection.extraId, insurance.id),
              inArray(applicationExtraSelection.applicationId, memberIds),
            ),
          )
      : [];
  const insuranceSelectedByApplicationId: Record<string, boolean> = {};
  for (const row of selectionRows) {
    insuranceSelectedByApplicationId[row.applicationId] = row.selected;
  }

  const openPayments =
    memberIds.length === 0
      ? []
      : await tx
          .select({ status: payment.status })
          .from(payment)
          .where(
            and(inArray(payment.applicationId, memberIds), eq(payment.status, "checkout_created")),
          );

  return {
    partyId: requested.partyId,
    currency: party?.catalogCurrency ?? requested.catalogCurrency,
    travelDate: party?.travelDate ?? null,
    processingSpeed: asSpeed(party?.processingSpeed),
    processingSpeedSource: asSource(party?.processingSpeedSource),
    members: memberRows,
    insuranceSelectedByApplicationId,
    catalog,
    openPayments,
  };
};

const catalogByKey = (catalog: readonly TCheckoutExtraCatalog[], key: TCheckoutExtraKey) =>
  catalog.find((extra) => extra.key === key);

export const buildQuotePreview = (input: {
  currency: string;
  now: Date;
  travelDateRequired: boolean;
  thresholdDays: number;
  maxDaysAhead: number;
  travelDate: string | null;
  storedSpeed: TProcessingSpeed | null;
  storedSource: TProcessingSpeedSource | null;
  members: readonly TPartyMemberRow[];
  visaAmounts: Readonly<Record<string, bigint>>;
  catalog: readonly TCheckoutExtraCatalog[];
  insuranceSelectedByApplicationId: Readonly<Record<string, boolean>>;
  /** Quote currency. Extras are priced in this currency, which may match the party currency. */
  quoteCurrency?: string;
  openPayments?: readonly TOpenPaymentRow[];
}): TQuotePreview => {
  const currency = input.quoteCurrency ?? input.currency;
  const { todayUae, maxTravelDate } = travelDateWindow(input.now, input.maxDaysAhead);
  const daysUntil = input.travelDate ? daysUntilTravel(input.travelDate, input.now) : null;
  const fastTrack = catalogByKey(input.catalog, "fast_track");
  const fastTrackAvailable = fastTrack
    ? availabilityForCurrency(fastTrack, currency).available
    : false;
  const speed = nextProcessingSpeed({
    stored: { speed: input.storedSpeed, source: input.storedSource },
    daysUntil,
    thresholdDays: input.thresholdDays,
    fastTrackAvailable,
    customerChoice: null,
  });
  const resolved = resolveCheckoutExtras({
    currency,
    members: input.members.map((member) => ({ applicationId: member.applicationId })),
    catalog: input.catalog,
    insuranceSelectedByApplicationId: input.insuranceSelectedByApplicationId,
    processingSpeed: speed.speed,
  });
  const visaLines: TVisaChargeLine[] = input.members.map((member) => ({
    applicationId: member.applicationId,
    serviceId: member.serviceId,
    amountMinor: input.visaAmounts[member.applicationId] ?? BigInt(0),
    currency,
  }));
  const charge = buildCheckoutCharge({
    visaLines,
    extraLines: resolved.lines,
    currency,
    fxSource: null,
    travelDate: input.travelDate,
    processingSpeed: speed.speed,
  });
  const travellerCount = input.members.length;
  const availableExtras: TAvailableExtraQuote[] = resolved.availability.flatMap((item) => {
    if (!item.available || item.unitAmountMinor === null) return [];
    const copy = catalogByKey(input.catalog, item.key);
    const selected =
      item.key === "fast_track"
        ? speed.speed === "fast_track"
        : travellerCount > 0 &&
          input.members.every((member) => input.insuranceSelectedByApplicationId[member.applicationId] === true);
    return [
      {
        key: item.key,
        unitAmountMinor: item.unitAmountMinor.toString(),
        travellerCount,
        sumAmountMinor: partySumMinor(item.unitAmountMinor, item.chargeBasis, travellerCount).toString(),
        selected,
        chargeBasis: item.chargeBasis,
        labelI18n: copy?.labelI18n ?? {},
        descriptionI18n: copy?.descriptionI18n ?? {},
        promiseI18n: copy?.promiseI18n ?? null,
        termsUrl: copy?.termsUrl ?? null,
      },
    ];
  });

  return {
    currency,
    todayUae,
    maxTravelDate,
    travelDateRequired: input.travelDateRequired,
    thresholdDays: input.thresholdDays,
    travelDate: input.travelDate,
    daysUntilTravel: daysUntil,
    recommendFastTrack: recommendFastTrack(daysUntil, input.thresholdDays),
    processingSpeed: speed.speed,
    processingSpeedSource: speed.source,
    locked: tripEditsLocked(input.members, input.openPayments ?? []),
    travellerCount,
    visaLines: visaLines.map((line) => ({
      applicationId: line.applicationId,
      serviceId: line.serviceId,
      amountMinor: line.amountMinor.toString(),
    })),
    extraLines: resolved.lines.map((line) => ({
      key: line.key,
      applicationId: line.applicationId,
      amountMinor: line.amountMinor.toString(),
    })),
    availableExtras,
    visaAmountMinor: charge.visaAmountMinor.toString(),
    extrasAmountMinor: charge.extrasAmountMinor.toString(),
    totalAmountMinor: charge.totalMinor.toString(),
  };
};

const writeExtraSelection = async (
  tx: DbTransaction,
  memberIds: readonly string[],
  extraId: string,
  selected: boolean,
) => {
  if (memberIds.length === 0) return;
  await tx
    .insert(applicationExtraSelection)
    .values(memberIds.map((applicationId) => ({ applicationId, extraId, selected })))
    .onConflictDoUpdate({
      target: [applicationExtraSelection.applicationId, applicationExtraSelection.extraId],
      set: { selected, updatedAt: new Date() },
    });
};

const persistSpeed = async (
  tx: DbTransaction,
  partyId: string,
  speed: TProcessingSpeed | null,
  source: TProcessingSpeedSource | null,
  fastTrackExtraId: string | null,
  memberIds: readonly string[],
) => {
  await tx
    .update(applicationParty)
    .set({
      processingSpeed: speed,
      processingSpeedSource: source,
      updatedAt: new Date(),
    })
    .where(eq(applicationParty.id, partyId));
  if (fastTrackExtraId && speed) {
    await writeExtraSelection(tx, memberIds, fastTrackExtraId, speed === "fast_track");
  }
};

export const checkoutArrivalDateError = (input: {
  travelDate: string | null;
  settingRequired: boolean;
  currency: string;
  catalog: readonly { enabled: boolean; prices: readonly { currency: string }[] }[];
  todayUae: string;
  maxTravelDate: string;
}) =>
  checkoutTravelDateError({
    travelDate: input.travelDate,
    required: input.settingRequired,
    todayUae: input.todayUae,
    maxTravelDate: input.maxTravelDate,
    anyExtraEnabled: input.catalog.some((extra) => extraIsPriced(extra, input.currency)),
  });

export const applyPartyExtrasToCheckout = async (
  tx: DbTransaction,
  input: {
    partyId: string | null;
    members: readonly TVisaChargeLine[];
    fxSource: string | null;
    now?: Date;
  },
): Promise<
  | {
      ok: true;
      totalMinor: bigint;
      breakdownJson: string;
      ziinaAmountMinor: bigint;
      fincraAmountMinor: bigint;
      dropped: Array<{ key: TCheckoutExtraKey; reason: string }>;
    }
  | { ok: false; reason: string; message: string }
> => {
  const now = input.now ?? new Date();
  const currency = input.members[0]?.currency ?? "USD";
  const catalog = await loadCheckoutExtraCatalog(tx);
  const settings = await getTravelDateSettingsFromTx(tx);
  const { todayUae, maxTravelDate } = travelDateWindow(now, settings.travelDateMaxDaysAhead);

  const [party] = input.partyId
    ? await tx
        .select({
          travelDate: applicationParty.travelDate,
          processingSpeed: applicationParty.processingSpeed,
          processingSpeedSource: applicationParty.processingSpeedSource,
        })
        .from(applicationParty)
        .where(eq(applicationParty.id, input.partyId))
        .limit(1)
    : [];

  const travelDate = party?.travelDate ?? null;
  const dateError = checkoutArrivalDateError({
    travelDate,
    settingRequired: settings.travelDateRequired,
    currency,
    catalog,
    todayUae,
    maxTravelDate,
  });
  if (dateError) {
    return { ok: false, reason: travelDateReason(dateError), message: travelDateErrorMessage(dateError, maxTravelDate) };
  }

  const insurance = catalogByKey(catalog, "travel_insurance");
  const memberIds = input.members.map((member) => member.applicationId);
  const selectionRows =
    insurance && memberIds.length > 0
      ? await tx
          .select({
            applicationId: applicationExtraSelection.applicationId,
            selected: applicationExtraSelection.selected,
          })
          .from(applicationExtraSelection)
          .where(
            and(
              eq(applicationExtraSelection.extraId, insurance.id),
              inArray(applicationExtraSelection.applicationId, memberIds),
            ),
          )
      : [];
  const insuranceSelectedByApplicationId: Record<string, boolean> = {};
  for (const row of selectionRows) insuranceSelectedByApplicationId[row.applicationId] = row.selected;

  const fastTrack = catalogByKey(catalog, "fast_track");
  const fastTrackAvailable = fastTrack ? availabilityForCurrency(fastTrack, currency).available : false;
  const storedSpeed = asSpeed(party?.processingSpeed);
  const storedSource = asSource(party?.processingSpeedSource);
  const daysUntil = travelDate ? daysUntilTravel(travelDate, now) : null;
  const speed = nextProcessingSpeed({
    stored: { speed: storedSpeed, source: storedSource },
    daysUntil,
    thresholdDays: settings.fastTrackThresholdDays,
    fastTrackAvailable,
    customerChoice: null,
  });

  if (
    input.partyId &&
    (speed.speed !== storedSpeed || speed.source !== storedSource) &&
    (speed.speed !== null || storedSpeed !== null)
  ) {
    await persistSpeed(tx, input.partyId, speed.speed, speed.source, fastTrack?.id ?? null, memberIds);
  }

  const resolved = resolveCheckoutExtras({
    currency,
    members: input.members.map((member) => ({ applicationId: member.applicationId })),
    catalog,
    insuranceSelectedByApplicationId,
    processingSpeed: speed.speed,
  });
  const charge = buildCheckoutCharge({
    visaLines: input.members,
    extraLines: resolved.lines,
    currency,
    fxSource: input.fxSource,
    travelDate,
    processingSpeed: speed.speed,
  });
  return {
    ok: true,
    totalMinor: charge.totalMinor,
    breakdownJson: charge.breakdownJson,
    ziinaAmountMinor: charge.ziinaAmountMinor,
    fincraAmountMinor: charge.fincraAmountMinor,
    dropped: resolved.dropped,
  };
};

export type TSaveTripResult =
  | { ok: true; preview: TQuotePreview }
  | {
      ok: false;
      status: 400 | 404 | 409;
      code: "VALIDATION_ERROR" | "CHECKOUT_FROZEN" | "NOT_FOUND";
      reason: string;
      message: string;
    };

const lockApplicationsForTrip = async (
  tx: DbTransaction,
  applicationId: string,
): Promise<boolean> => {
  const [requested] = await tx
    .select({ id: application.id, partyId: application.partyId })
    .from(application)
    .where(eq(application.id, applicationId))
    .for("update")
    .limit(1);
  if (!requested) return false;
  if (requested.partyId) {
    await tx
      .select({ id: application.id })
      .from(application)
      .where(eq(application.partyId, requested.partyId))
      .orderBy(asc(application.travelerIndex))
      .for("update");
  }
  return true;
};

export const savePartyTrip = async (
  tx: DbTransaction,
  applicationId: string,
  patch: TTripPatch,
  now: Date = new Date(),
): Promise<TSaveTripResult> => {
  const held = await lockApplicationsForTrip(tx, applicationId);
  if (!held) {
    return { ok: false, status: 404, code: "NOT_FOUND", reason: "not_found", message: "Application not found" };
  }
  const state = await loadPartyTripState(tx, applicationId);
  if (!state) {
    return { ok: false, status: 404, code: "NOT_FOUND", reason: "not_found", message: "Application not found" };
  }
  const settings = await getTravelDateSettingsFromTx(tx);
  const { todayUae, maxTravelDate } = travelDateWindow(now, settings.travelDateMaxDaysAhead);
  const currency = state.currency;
  const fastTrack = catalogByKey(state.catalog, "fast_track");
  const insurance = catalogByKey(state.catalog, "travel_insurance");
  const plan = planTripUpdate({
    locked: tripEditsLocked(state.members, state.openPayments),
    stored: {
      travelDate: state.travelDate,
      processingSpeed: state.processingSpeed,
      processingSpeedSource: state.processingSpeedSource,
      insuranceSelectedByApplicationId: state.insuranceSelectedByApplicationId,
    },
    patch,
    memberIds: state.members.map((member) => member.applicationId),
    todayUae,
    maxTravelDate,
    travelDateRequired: settings.travelDateRequired,
    thresholdDays: settings.fastTrackThresholdDays,
    fastTrackAvailable: fastTrack ? availabilityForCurrency(fastTrack, currency).available : false,
    insuranceAvailable: insurance ? availabilityForCurrency(insurance, currency).available : false,
    now,
  });
  if (!plan.ok) {
    return {
      ok: false,
      status: plan.code === "EXTRAS_LOCKED" ? 409 : 400,
      code: plan.code === "EXTRAS_LOCKED" ? "CHECKOUT_FROZEN" : "VALIDATION_ERROR",
      reason: plan.reason,
      message: plan.message,
    };
  }
  if (!state.partyId) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION_ERROR",
      reason: "party_missing",
      message: "This application has no trip to update.",
    };
  }

  const visaAmounts: Record<string, bigint> = {};
  for (const member of state.members) {
    const price = await resolveCheckoutTotal(tx, {
      nationalityCode: member.nationalityCode,
      serviceId: member.serviceId,
      catalogCurrency: currency,
    });
    if (!price || price.currency !== currency) {
      return {
        ok: false,
        status: 400,
        code: "VALIDATION_ERROR",
        reason: "pricing_unavailable",
        message: "Pricing unavailable for this nationality/service/currency combination",
      };
    }
    visaAmounts[member.applicationId] = price.displayMinor;
  }

  await tx
    .update(applicationParty)
    .set({
      travelDate: plan.next.travelDate,
      processingSpeed: plan.next.processingSpeed,
      processingSpeedSource: plan.next.processingSpeedSource,
      updatedAt: new Date(),
    })
    .where(eq(applicationParty.id, state.partyId));

  const memberIds = state.members.map((member) => member.applicationId);
  if (fastTrack && plan.next.processingSpeed) {
    await writeExtraSelection(tx, memberIds, fastTrack.id, plan.next.processingSpeed === "fast_track");
  }
  if (insurance && patch.travelInsurance !== undefined) {
    await writeExtraSelection(tx, memberIds, insurance.id, patch.travelInsurance);
  }

  return {
    ok: true,
    preview: buildQuotePreview({
      currency,
      now,
      travelDateRequired: settings.travelDateRequired,
      thresholdDays: settings.fastTrackThresholdDays,
      maxDaysAhead: settings.travelDateMaxDaysAhead,
      travelDate: plan.next.travelDate,
      storedSpeed: plan.next.processingSpeed,
      storedSource: plan.next.processingSpeedSource,
      members: state.members,
      visaAmounts,
      catalog: state.catalog,
      insuranceSelectedByApplicationId: plan.next.insuranceSelectedByApplicationId,
      openPayments: state.openPayments,
    }),
  };
};

export const previewPartyQuote = async (
  tx: DbTransaction,
  applicationId: string,
  now: Date = new Date(),
): Promise<
  | { ok: true; preview: TQuotePreview }
  | { ok: false; reason: string; message: string }
> => {
  const state = await loadPartyTripState(tx, applicationId);
  if (!state) return { ok: false, reason: "not_found", message: "Application not found" };
  const settings = await getTravelDateSettingsFromTx(tx);
  const visaAmounts: Record<string, bigint> = {};
  for (const member of state.members) {
    const price = await resolveCheckoutTotal(tx, {
      nationalityCode: member.nationalityCode,
      serviceId: member.serviceId,
      catalogCurrency: state.currency,
    });
    if (!price || price.currency !== state.currency) {
      return {
        ok: false,
        reason: "pricing_unavailable",
        message: "Pricing unavailable for this nationality/service/currency combination",
      };
    }
    visaAmounts[member.applicationId] = price.displayMinor;
  }
  return {
    ok: true,
    preview: buildQuotePreview({
      currency: state.currency,
      now,
      travelDateRequired: settings.travelDateRequired,
      thresholdDays: settings.fastTrackThresholdDays,
      maxDaysAhead: settings.travelDateMaxDaysAhead,
      travelDate: state.travelDate,
      storedSpeed: state.processingSpeed,
      storedSource: state.processingSpeedSource,
      members: state.members,
      visaAmounts,
      catalog: state.catalog,
      insuranceSelectedByApplicationId: state.insuranceSelectedByApplicationId,
      openPayments: state.openPayments,
    }),
  };
};

export const initialDraftSpeed = (input: {
  travelDate: string;
  now: Date;
  thresholdDays: number;
  fastTrackAvailable: boolean;
}): { processingSpeed: TProcessingSpeed; processingSpeedSource: "system" } => {
  const speed = nextProcessingSpeed({
    stored: { speed: null, source: null },
    daysUntil: daysUntilTravel(input.travelDate, input.now),
    thresholdDays: input.thresholdDays,
    fastTrackAvailable: input.fastTrackAvailable,
    customerChoice: null,
  });
  return {
    processingSpeed: speed.speed ?? "standard",
    processingSpeedSource: "system",
  };
};
