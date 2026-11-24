/** Calendar dates for checkout extras. The customer-facing "today" is Asia/Dubai, not the server TZ. */

const UAE_TIME_ZONE = "Asia/Dubai";
const MS_PER_DAY = 86_400_000;

export type TTravelDateErrorCode = "required" | "invalid" | "past" | "too_far";

const pad = (value: number): string => String(value).padStart(2, "0");

export const isRealIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
};

/** YYYY-MM-DD in Asia/Dubai. Dubai has no DST (UTC+4). */
export const uaeCalendarDate = (now: Date): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: UAE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Could not read the UAE calendar date");
  }
  return `${year}-${month}-${day}`;
};

export const addCalendarDays = (isoDate: string, days: number): string => {
  if (!isRealIsoDate(isoDate)) {
    throw new Error("Arrival date must be YYYY-MM-DD");
  }
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  utc.setUTCDate(utc.getUTCDate() + days);
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
};

/** Whole calendar days from UAE today until `travelDate`. 0 means the customer arrives today. */
export const daysUntilTravel = (travelDate: string, now: Date): number => {
  if (!isRealIsoDate(travelDate)) {
    throw new Error("Arrival date must be YYYY-MM-DD");
  }
  const today = uaeCalendarDate(now);
  const [todayYear, todayMonth, todayDay] = today.split("-").map((part) => Number(part));
  const [travelYear, travelMonth, travelDay] = travelDate.split("-").map((part) => Number(part));
  const todayUtc = Date.UTC(todayYear!, todayMonth! - 1, todayDay!);
  const travelUtc = Date.UTC(travelYear!, travelMonth! - 1, travelDay!);
  return Math.round((travelUtc - todayUtc) / MS_PER_DAY);
};

export const travelDateWindow = (
  now: Date,
  maxDaysAhead: number,
): { todayUae: string; maxTravelDate: string } => {
  const todayUae = uaeCalendarDate(now);
  return { todayUae, maxTravelDate: addCalendarDays(todayUae, maxDaysAhead) };
};

/**
 * Recommend Fast Track when the arrival is strictly sooner than the threshold.
 * 3 days with threshold 4 recommends; 4 and 5 do not.
 */
export const recommendFastTrack = (daysUntil: number | null, thresholdDays: number): boolean =>
  daysUntil !== null && daysUntil < thresholdDays;

export const validateTravelDate = (
  value: string | null,
  opts: { required: boolean; todayUae: string; maxTravelDate: string },
): { ok: true; date: string | null } | { ok: false; code: TTravelDateErrorCode } => {
  if (value === null || value.trim() === "") {
    if (opts.required) return { ok: false, code: "required" };
    return { ok: true, date: null };
  }
  const date = value.trim();
  if (!isRealIsoDate(date)) return { ok: false, code: "invalid" };
  if (date < opts.todayUae) return { ok: false, code: "past" };
  if (date > opts.maxTravelDate) return { ok: false, code: "too_far" };
  return { ok: true, date };
};

export const travelDateErrorMessage = (code: TTravelDateErrorCode, maxTravelDate: string): string => {
  switch (code) {
    case "required":
      return "Choose your arrival date to continue.";
    case "invalid":
      return "Enter the full date: day, month and year.";
    case "past":
      return "This date has passed. Choose today or a later date.";
    case "too_far":
      return `Choose a date up to ${maxTravelDate}.`;
    default:
      return "Choose a valid arrival date.";
  }
};

export const travelDateReason = (code: TTravelDateErrorCode): string => {
  switch (code) {
    case "required":
      return "travel_date_required";
    case "past":
      return "travel_date_past";
    case "too_far":
      return "travel_date_too_far";
    case "invalid":
      return "travel_date_invalid";
    default:
      return "travel_date_invalid";
  }
};
