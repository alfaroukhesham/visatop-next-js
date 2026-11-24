import { addCalendarDays, isRealIsoDate } from "@/lib/checkout-extras/dubai-calendar";

export type TMonthParts = {
  year: number;
  month: number;
};

export type TMonthCell = {
  iso: string;
  inMonth: boolean;
  disabled: boolean;
};

export type TWeekdayHeader = {
  visible: string;
  label: string;
};

const pad = (value: number): string => String(value).padStart(2, "0");

export const calendarLocale = (locale: string): string => {
  const trimmed = locale.trim();
  return trimmed || "en";
};

type TWeekInfo = { firstDay?: number };

type TWeekInfoLocale = Intl.Locale & {
  weekInfo?: TWeekInfo;
  getWeekInfo?: () => TWeekInfo;
};

/** Sunday = 0 … Saturday = 6, from the locale's week info. */
export const weekStartsOn = (locale: string): number => {
  try {
    const intlLocale = new Intl.Locale(calendarLocale(locale)) as TWeekInfoLocale;
    const info = intlLocale.getWeekInfo?.() ?? intlLocale.weekInfo;
    const firstDay = info?.firstDay;
    if (typeof firstDay === "number" && firstDay >= 1 && firstDay <= 7) return firstDay % 7;
  } catch {
    return 0;
  }
  return 0;
};

export const monthPartsFromIso = (iso: string): TMonthParts => ({
  year: Number(iso.slice(0, 4)),
  month: Number(iso.slice(5, 7)),
});

export const monthKey = ({ year, month }: TMonthParts): string => `${year}-${pad(month)}`;

export const shiftMonth = ({ year, month }: TMonthParts, delta: number): TMonthParts => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

export const clampMonth = (
  parts: TMonthParts,
  todayUae: string,
  maxTravelDate: string,
): TMonthParts => {
  const key = monthKey(parts);
  const minKey = todayUae.slice(0, 7);
  const maxKey = maxTravelDate.slice(0, 7);
  if (key < minKey) return monthPartsFromIso(todayUae);
  if (key > maxKey) return monthPartsFromIso(maxTravelDate);
  return parts;
};

export const canShiftMonth = (
  parts: TMonthParts,
  delta: -1 | 1,
  todayUae: string,
  maxTravelDate: string,
): boolean => {
  const next = monthKey(shiftMonth(parts, delta));
  if (delta < 0) return next >= todayUae.slice(0, 7);
  return next <= maxTravelDate.slice(0, 7);
};

const weekdayDate = (weekStart: number, index: number): Date =>
  new Date(Date.UTC(2023, 0, 1 + ((weekStart + index) % 7)));

const latinShort = (value: string): string | null => {
  const compact = value.replace(/\./g, "").trim();
  if (!compact || !/^[\p{Script=Latin}]+$/u.test(compact)) return null;
  return compact.slice(0, 2);
};

export const weekdayHeaders = (locale: string, weekStart: number): TWeekdayHeader[] => {
  const tag = calendarLocale(locale);
  const shortFmt = new Intl.DateTimeFormat(tag, {
    weekday: "short",
    timeZone: "UTC",
    numberingSystem: "latn",
  });
  const narrowFmt = new Intl.DateTimeFormat(tag, {
    weekday: "narrow",
    timeZone: "UTC",
    numberingSystem: "latn",
  });
  const longFmt = new Intl.DateTimeFormat(tag, {
    weekday: "long",
    timeZone: "UTC",
    numberingSystem: "latn",
  });
  return Array.from({ length: 7 }, (_, index) => {
    const date = weekdayDate(weekStart, index);
    const short = shortFmt.format(date);
    const narrow = narrowFmt.format(date);
    return {
      visible: latinShort(short) ?? (short.length <= 2 ? short : narrow),
      label: longFmt.format(date),
    };
  });
};

export const formatCalendarMonthTitle = (parts: TMonthParts, locale: string): string =>
  new Intl.DateTimeFormat(calendarLocale(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    numberingSystem: "latn",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, 1, 12)));

export const formatCalendarDayNumber = (iso: string, locale: string): string =>
  new Intl.NumberFormat(calendarLocale(locale), {
    numberingSystem: "latn",
    useGrouping: false,
  }).format(Number(iso.slice(8, 10)));

export const formatCalendarSelection = (iso: string, locale: string): string => {
  if (!isRealIsoDate(iso)) return "";
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  return new Intl.DateTimeFormat(calendarLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    numberingSystem: "latn",
  }).format(new Date(Date.UTC(year!, month! - 1, day!, 12)));
};

export const formatCalendarDayLabel = (iso: string, locale: string): string => {
  if (!isRealIsoDate(iso)) return "";
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  return new Intl.DateTimeFormat(calendarLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    numberingSystem: "latn",
  }).format(new Date(Date.UTC(year!, month! - 1, day!, 12)));
};

/** Six-week month grid. Past days and days after `maxTravelDate` are disabled. Today is allowed. */
export const buildMonthGrid = (input: {
  parts: TMonthParts;
  weekStart: number;
  todayUae: string;
  maxTravelDate: string;
}): TMonthCell[] => {
  const firstIso = `${monthKey(input.parts)}-01`;
  const firstWeekday = new Date(
    Date.UTC(input.parts.year, input.parts.month - 1, 1),
  ).getUTCDay();
  const lead = (firstWeekday - input.weekStart + 7) % 7;
  const start = addCalendarDays(firstIso, -lead);
  const prefix = `${monthKey(input.parts)}-`;
  return Array.from({ length: 42 }, (_, index) => {
    const iso = addCalendarDays(start, index);
    return {
      iso,
      inMonth: iso.startsWith(prefix),
      disabled: iso < input.todayUae || iso > input.maxTravelDate,
    };
  });
};
