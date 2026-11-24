import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  canShiftMonth,
  formatCalendarDayNumber,
  formatCalendarMonthTitle,
  formatCalendarSelection,
  monthPartsFromIso,
  weekStartsOn,
  visibleMonthCells,
  weekdayHeaders,
} from "@/lib/apply/month-calendar";

const november = monthPartsFromIso("2026-11-01");

describe("month calendar", () => {
  it("starts English weeks on Sunday and Arabic weeks on Saturday", () => {
    expect(weekStartsOn("en")).toBe(0);
    expect(weekStartsOn("ar")).toBe(6);
    expect(weekdayHeaders("en", 0).map((day) => day.visible)).toEqual([
      "Su",
      "Mo",
      "Tu",
      "We",
      "Th",
      "Fr",
      "Sa",
    ]);
    expect(weekdayHeaders("ar", 6)[0]?.label).toMatch(/سبت/);
  });

  it("keeps weekday headers distinct, including Hausa three-letter names", () => {
    for (const locale of ["en", "ar", "de", "es", "fr", "ha", "hi", "it", "ru", "tl", "tr"]) {
      const visible = weekdayHeaders(locale, weekStartsOn(locale)).map((day) => day.visible);
      expect(new Set(visible).size, locale).toBe(visible.length);
    }
    expect(weekdayHeaders("ha", weekStartsOn("ha")).map((day) => day.visible)).toEqual([
      "Lit",
      "Tal",
      "Lar",
      "Alh",
      "Jum",
      "Asa",
      "Lah",
    ]);
  });

  it("drops a trailing week that is entirely in the next month", () => {
    const cells = buildMonthGrid({
      parts: november,
      weekStart: 0,
      todayUae: "2026-11-24",
      maxTravelDate: "2027-05-23",
    });
    const visible = visibleMonthCells(cells);
    expect(cells).toHaveLength(42);
    expect(visible).toHaveLength(35);
    expect(visible.at(-1)?.iso).toBe("2026-12-05");
    expect(visible.some((cell) => cell.iso === "2026-12-06")).toBe(false);
  });

  it("builds a 6-week November 2026 grid with past days disabled and today allowed", () => {
    const cells = buildMonthGrid({
      parts: november,
      weekStart: 0,
      todayUae: "2026-11-24",
      maxTravelDate: "2027-05-23",
    });
    expect(cells).toHaveLength(42);
    expect(cells[0]?.iso).toBe("2026-11-01");
    expect(cells[22]).toMatchObject({ iso: "2026-11-23", disabled: true, inMonth: true });
    expect(cells[23]).toMatchObject({ iso: "2026-11-24", disabled: false, inMonth: true });
    expect(cells[30]).toMatchObject({ iso: "2026-12-01", disabled: false, inMonth: false });
    expect(cells.at(-1)?.iso).toBe("2026-12-12");
  });

  it("disables days after the maximum travel date and blocks the previous month", () => {
    const cells = buildMonthGrid({
      parts: monthPartsFromIso("2027-05-01"),
      weekStart: 0,
      todayUae: "2026-11-24",
      maxTravelDate: "2027-05-23",
    });
    expect(cells.find((cell) => cell.iso === "2027-05-23")?.disabled).toBe(false);
    expect(cells.find((cell) => cell.iso === "2027-05-24")?.disabled).toBe(true);
    expect(canShiftMonth(november, -1, "2026-11-24", "2027-05-23")).toBe(false);
    expect(canShiftMonth(november, 1, "2026-11-24", "2027-05-23")).toBe(true);
    expect(canShiftMonth(monthPartsFromIso("2027-05-01"), 1, "2026-11-24", "2027-05-23")).toBe(false);
  });

  it("formats month, day and selection with Latin digits", () => {
    expect(formatCalendarMonthTitle(november, "en")).toBe("November 2026");
    expect(formatCalendarMonthTitle(november, "ar")).toMatch(/2026/);
    expect(formatCalendarMonthTitle(november, "ar")).not.toMatch(/[٠-٩]/);
    expect(formatCalendarDayNumber("2026-11-24", "ar")).toBe("24");
    expect(formatCalendarSelection("2026-11-24", "en")).toBe("November 24, 2026");
    expect(formatCalendarSelection("2026-11-24", "ar")).not.toMatch(/[٠-٩]/);
  });
});
