import type { TProcessingSpeed, TProcessingSpeedSource } from "@/lib/db/schema/checkout-extra";
import {
  daysUntilTravel,
  travelDateErrorMessage,
  travelDateReason,
  validateTravelDate,
  type TTravelDateErrorCode,
} from "@/lib/checkout-extras/dubai-calendar";
import { nextPartyInsurance } from "@/lib/checkout-extras/party-insurance";

export type TStoredSpeed = {
  speed: TProcessingSpeed | null;
  source: TProcessingSpeedSource | null;
};

/**
 * A customer choice is stored as `customer`.
 * The default is Standard with source `system`. A missing date does not pick Fast Track.
 * An older system Fast Track row (the removed pre-select) falls back to Standard.
 */
export const nextProcessingSpeed = (input: {
  stored: TStoredSpeed;
  daysUntil: number | null;
  thresholdDays: number;
  fastTrackAvailable: boolean;
  customerChoice: TProcessingSpeed | null;
}): TStoredSpeed => {
  if (input.customerChoice === "fast_track" && !input.fastTrackAvailable) {
    return { speed: "standard", source: "system" };
  }
  if (input.customerChoice) {
    return { speed: input.customerChoice, source: "customer" };
  }
  if (input.stored.source === "customer" && input.stored.speed) {
    return { speed: input.stored.speed, source: "customer" };
  }
  return { speed: "standard", source: "system" };
};

/** Speed saved with a new application. Fast Track counts only when the customer chose it and it is priced. */
export const resolveDraftProcessingSpeed = (input: {
  requestedSpeed: TProcessingSpeed | null;
  requestedSource: TProcessingSpeedSource | null;
  fastTrackAvailable: boolean;
}): { processingSpeed: TProcessingSpeed; processingSpeedSource: TProcessingSpeedSource } => {
  const resolved = nextProcessingSpeed({
    stored: { speed: null, source: null },
    daysUntil: null,
    thresholdDays: 4,
    fastTrackAvailable: input.fastTrackAvailable,
    customerChoice:
      input.requestedSpeed === "fast_track" || input.requestedSource === "customer"
        ? (input.requestedSpeed ?? "standard")
        : null,
  });
  return {
    processingSpeed: resolved.speed ?? "standard",
    processingSpeedSource: resolved.source ?? "system",
  };
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

export type TTripInsuranceSelection = {
  applicationId: string;
  selected: boolean;
};

export type TTripPatch = {
  travelDate?: string | null;
  processingSpeed?: TProcessingSpeed;
  /**
   * Legacy per-traveller payload. A mixed list is applied to the whole party:
   * any selected traveller turns insurance on for everyone.
   */
  travelInsurance?: readonly TTripInsuranceSelection[];
  /** One tickbox for the whole party. Wins over `travelInsurance` when both are sent. */
  insuranceForParty?: boolean;
};

export type TTripPlan =
  | {
      ok: false;
      abandonCheckout: false;
      code: "EXTRAS_LOCKED" | "TRAVEL_DATE" | "EXTRA_UNAVAILABLE" | "SPEED_LOCKED";
      reason: string;
      message: string;
    }
  | { ok: true; abandonCheckout: false; next: TTripSnapshot };

const failure = (
  code: "EXTRAS_LOCKED" | "TRAVEL_DATE" | "EXTRA_UNAVAILABLE" | "SPEED_LOCKED",
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
  /** Speed changes are accepted only from the visa list. Later steps must omit this. */
  speedChangeAllowed?: boolean;
  now: Date;
}): TTripPlan => {
  const gate = planTripWrite(input.locked);
  if (!gate.allow) {
    return failure("EXTRAS_LOCKED", "extras_locked", "To change your extras, cancel this payment first.");
  }

  if (input.patch.processingSpeed && input.speedChangeAllowed !== true) {
    return failure(
      "SPEED_LOCKED",
      "speed_locked",
      "Processing speed can only be changed on the visa list.",
    );
  }

  let travelDate = input.stored.travelDate;
  if (input.patch.travelDate !== undefined) {
    const validated = validateTravelDate(input.patch.travelDate, {
      required: false,
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
  const insurancePatch = input.patch.travelInsurance;
  const turningInsuranceOn =
    input.patch.insuranceForParty === true || Boolean(insurancePatch?.some((row) => row.selected));
  if (turningInsuranceOn && !input.insuranceAvailable) {
    return failure(
      "EXTRA_UNAVAILABLE",
      "travel_insurance_unavailable",
      "Travel insurance is not available for this currency.",
    );
  }
  const memberSet = new Set(input.memberIds);
  if (insurancePatch?.some((row) => !memberSet.has(row.applicationId))) {
    return failure(
      "EXTRA_UNAVAILABLE",
      "travel_insurance_traveller",
      "Travel insurance can only be chosen for travellers on this application.",
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

  const insuranceSelectedByApplicationId = nextPartyInsurance({
    memberIds: input.memberIds,
    stored: input.stored.insuranceSelectedByApplicationId,
    insuranceForParty: input.patch.insuranceForParty,
    travelInsurance: insurancePatch,
  });

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
 * A provided date is re-checked. A missing date is allowed: the travel-date step
 * is skippable, including when extras are on. The admin required flag may stay
 * on, but it does not block checkout.
 */
export const checkoutTravelDateError = (input: {
  travelDate: string | null;
  required: boolean;
  todayUae: string;
  maxTravelDate: string;
  anyExtraEnabled: boolean;
}): TTravelDateErrorCode | null => {
  void input.required;
  void input.anyExtraEnabled;
  if (!input.travelDate) return null;
  const validated = validateTravelDate(input.travelDate, {
    required: true,
    todayUae: input.todayUae,
    maxTravelDate: input.maxTravelDate,
  });
  return validated.ok ? null : validated.code;
};
