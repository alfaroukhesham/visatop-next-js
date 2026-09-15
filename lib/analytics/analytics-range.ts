export type TInstantRange = {
  from: Date;
  to: Date;
};

const MAX_RANGE_MS = 3 * 365 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const previousPeriod = (range: TInstantRange): TInstantRange => {
  const ms = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - ms),
    to: range.from,
  };
};

export const deltaPct = (current: number, previous: number): number | null => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
};

export const utcMondayWeekStartIso = (date: Date): string => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  utc.setUTCDate(utc.getUTCDate() - offset);
  return utc.toISOString().slice(0, 10);
};

const parseIso = (value: string): Date | null => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

export type TParseAnalyticsRangeResult =
  | { ok: true; range: TInstantRange }
  | { ok: false; message: string };

export const parseAnalyticsRange = (
  input: { from?: string | null; to?: string | null },
  now: Date = new Date(),
): TParseAnalyticsRangeResult => {
  const fromRaw = input.from?.trim() || "";
  const toRaw = input.to?.trim() || "";
  if (!fromRaw && !toRaw) {
    return { ok: true, range: { from: new Date(now.getTime() - SEVEN_DAYS_MS), to: now } };
  }
  if (!fromRaw || !toRaw) {
    return { ok: false, message: "Both from and to are required for a custom range." };
  }
  const from = parseIso(fromRaw);
  const to = parseIso(toRaw);
  if (!from || !to) {
    return { ok: false, message: "from and to must be valid ISO timestamps." };
  }
  if (from.getTime() >= to.getTime()) {
    return { ok: false, message: "from must be earlier than to." };
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return { ok: false, message: "Range cannot exceed 3 years." };
  }
  return { ok: true, range: { from, to } };
};
