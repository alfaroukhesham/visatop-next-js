import { describe, expect, it } from "vitest";
import {
  deltaPct,
  parseAnalyticsRange,
  previousPeriod,
  utcMondayWeekStartIso,
} from "@/lib/analytics/analytics-range";

describe("previousPeriod", () => {
  it("returns an equal-length window ending at from", () => {
    const from = new Date("2026-09-08T00:00:00.000Z");
    const to = new Date("2026-09-15T00:00:00.000Z");
    expect(previousPeriod({ from, to })).toEqual({
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: from,
    });
  });
});

describe("parseAnalyticsRange", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");

  it("defaults to the last 7 days when from/to are omitted", () => {
    const parsed = parseAnalyticsRange({}, now);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.range.to).toEqual(now);
    expect(parsed.range.from).toEqual(new Date("2026-09-08T12:00:00.000Z"));
  });

  it("accepts explicit from/to", () => {
    const parsed = parseAnalyticsRange({
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-15T00:00:00.000Z",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.range.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(parsed.range.to.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("rejects from >= to", () => {
    const parsed = parseAnalyticsRange({
      from: "2026-09-15T00:00:00.000Z",
      to: "2026-09-01T00:00:00.000Z",
    });
    expect(parsed.ok).toBe(false);
  });

  it("rejects an incomplete custom pair", () => {
    expect(parseAnalyticsRange({ from: "2026-09-01T00:00:00.000Z" }).ok).toBe(false);
    expect(parseAnalyticsRange({ to: "2026-09-15T00:00:00.000Z" }).ok).toBe(false);
  });
});

describe("deltaPct", () => {
  it("computes percent change", () => {
    expect(deltaPct(12, 10)).toBe(20);
    expect(deltaPct(0, 0)).toBe(0);
    expect(deltaPct(5, 0)).toBeNull();
  });
});

describe("utcMondayWeekStartIso", () => {
  it("returns the Monday UTC date of that week", () => {
    expect(utcMondayWeekStartIso(new Date("2026-09-15T18:00:00.000Z"))).toBe("2026-09-14");
    expect(utcMondayWeekStartIso(new Date("2026-09-14T00:00:00.000Z"))).toBe("2026-09-14");
  });
});
