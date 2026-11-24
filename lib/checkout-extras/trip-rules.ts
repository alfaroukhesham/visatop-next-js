import type { TProcessingSpeed, TProcessingSpeedSource } from "@/lib/db/schema/checkout-extra";
import {
  daysUntilTravel,
  recommendFastTrack,
  travelDateErrorMessage,
  travelDateReason,
  validateTravelDate,
  type TTravelDateErrorCode,
} from "@/lib/checkout-extras/dubai-calendar";

export type TStoredSpeed = {
  speed: TProcessingSpeed | null;
  source: TProcessingSpeedSource | null;
};

/**
 * System preselect fills an empty or system-owned speed.
 * A customer choice is left as they set it, including after the arrival date changes.
 */
export const nextProcessingSpeed = (input: {
  stored: TStoredSpeed;
  daysUntil: number | null;
  thresholdDays: number;
  fastTrackAvailable: boolean;
  customerChoice: TProcessingSpeed | null;
}): TStoredSpeed => {
  if (input.customerChoice) {
    return { speed: input.customerChoice, source: "customer" };
  }
  if (input.stored.source === "customer" && input.stored.speed) {
    return { speed: input.stored.speed, source: "customer" };
  }
  if (input.daysUntil === null) {
    return { speed: input.stored.speed, source: input.stored.source };
  }
  const preselectFast = input.fastTrackAvailable && recommendFastTrack(input.daysUntil, input.thresholdDays);
  return { speed: preselectFast ? "fast_track" : "standard", source: "system" };
};

const SETTLED_PAYMENT = new Set(["paid", "refund_pending", "refunded"]);

export type TOpenPaymentRow = {
  status: string;
};

/**
 * An attempt is open only while a member row is still `pending` or a payment
 * row is still `checkout_created`. Application `paymentStatus` stays
 * `checkout_created` after a Ziina failure (that webhook only clears
 * `checkoutState`), so it is not an open attempt. Settled payments stay locked.
 */
export const tripEditsLocked = (
  members: readonly { paymentStatus: string; checkoutState: string | null }[],
  openPayments: readonly TOpenPaymentRow[] = [],
): boolean => {
  if (openPayments.some((row) => row.status === "checkout_created")) return true;
  return members.some(
    (member) => member.checkoutState === "pending" || SETTLED_PAYMENT.has(member.paymentStatus),
  );
};

/**
 * Extras stay locked for the life of the open attempt.
 * The change is rejected. The open Ziina/Fincra checkout is not abandoned.
 */
export const planTripWrite = (
  locked: boolean,
): { allow: boolean; abandonCheckout: false; code: "EXTRAS_LOCKED" | null } => {
  if (locked) return { allow: false, abandonCheckout: false, code: "EXTRAS_LOCKED" };
  return { allow: true, abandonCheckout: false, code: null };
};

export type TTripSnapshot = {
  travelDate: string | null;
  processingSpeed: TProcessingSpeed | null;
  processingSpeedSource: TProcessingSpeedSource | null;
  insuranceSelectedByApplicationId: Record<string, boolean>;
};

export type TTripPatch = {
  travelDate?: string | null;
  processingSpeed?: TProcessingSpeed;
  travelInsurance?: boolean;
};

export type TTripPlan =
  | {
      ok: false;
      abandonCheckout: false;
      code: "EXTRAS_LOCKED" | "TRAVEL_DATE" | "EXTRA_UNAVAILABLE";
      reason: string;
      message: string;
    }
  | { ok: true; abandonCheckout: false; next: TTripSnapshot };

const failure = (
  code: "EXTRAS_LOCKED" | "TRAVEL_DATE" | "EXTRA_UNAVAILABLE",
  reason: string,
  message: string,
): TTripPlan => ({ ok: false, abandonCheckout: false, code, reason, message });

export const planTripUpdate = (input: {
  locked: boolean;
  stored: TTripSnapshot;
  patch: TTripPatch;
  memberIds: readonly string[];
  todayUae: string;
  maxTravelDate: string;
  travelDateRequired: boolean;
  thresholdDays: number;
  fastTrackAvailable: boolean;
  insuranceAvailable: boolean;
  now: Date;
}): TTripPlan => {
  const gate = planTripWrite(input.locked);
  if (!gate.allow) {
    return failure("EXTRAS_LOCKED", "extras_locked", "To change your extras, cancel this payment first.");
  }

  let travelDate = input.stored.travelDate;
  if (input.patch.travelDate !== undefined) {
    const validated = validateTravelDate(input.patch.travelDate, {
      required: input.travelDateRequired,
      todayUae: input.todayUae,
      maxTravelDate: input.maxTravelDate,
    });
    if (!validated.ok) {
      return failure(
        "TRAVEL_DATE",
        travelDateReason(validated.code),
        travelDateErrorMessage(validated.code, input.maxTravelDate),
      );
    }
    travelDate = validated.date;
  }

  if (input.patch.processingSpeed === "fast_track" && !input.fastTrackAvailable) {
    return failure(
      "EXTRA_UNAVAILABLE",
      "fast_track_unavailable",
      "Fast Track is not available for this currency.",
    );
  }
  if (input.patch.travelInsurance === true && !input.insuranceAvailable) {
    return failure(
      "EXTRA_UNAVAILABLE",
      "travel_insurance_unavailable",
      "Travel insurance is not available for this currency.",
    );
  }

  const daysUntil = travelDate ? daysUntilTravel(travelDate, input.now) : null;
  const speed = nextProcessingSpeed({
    stored: {
      speed: input.stored.processingSpeed,
      source: input.stored.processingSpeedSource,
    },
    daysUntil,
    thresholdDays: input.thresholdDays,
    fastTrackAvailable: input.fastTrackAvailable,
    customerChoice: input.patch.processingSpeed ?? null,
  });

  const insuranceSelectedByApplicationId = { ...input.stored.insuranceSelectedByApplicationId };
  if (input.patch.travelInsurance !== undefined) {
    for (const memberId of input.memberIds) {
      insuranceSelectedByApplicationId[memberId] = input.patch.travelInsurance;
    }
  }

  return {
    ok: true,
    abandonCheckout: false,
    next: {
      travelDate,
      processingSpeed: speed.speed,
      processingSpeedSource: speed.source,
      insuranceSelectedByApplicationId,
    },
  };
};

/**
 * A stored date is always re-checked.
 * A missing date blocks checkout only once an extra is enabled, so a dark deploy
 * (extras still off, no arrival date on existing drafts) keeps today's visa total.
 */
export const checkoutTravelDateError = (input: {
  travelDate: string | null;
  required: boolean;
  todayUae: string;
  maxTravelDate: string;
  anyExtraEnabled: boolean;
}): TTravelDateErrorCode | null => {
  if (!input.travelDate) {
    if (input.required && input.anyExtraEnabled) return "required";
    return null;
  }
  const validated = validateTravelDate(input.travelDate, {
    required: true,
    todayUae: input.todayUae,
    maxTravelDate: input.maxTravelDate,
  });
  return validated.ok ? null : validated.code;
};
