import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  daysUntilTravel,
  recommendFastTrack,
  travelDateWindow,
  uaeCalendarDate,
  validateTravelDate,
} from "./dubai-calendar";

/** 24 Nov 2026 00:00 Asia/Dubai (UTC+4, no DST). */
const DUBAI_MIDNIGHT = new Date("2026-11-23T20:00:00.000Z");
const BEFORE_DUBAI_MIDNIGHT = new Date("2026-11-23T19:59:59.999Z");
const THRESHOLD = 4;

describe("UAE arrival dates", () => {
  it("rolls the calendar date at Dubai midnight, not UTC midnight", () => {
    expect(uaeCalendarDate(BEFORE_DUBAI_MIDNIGHT)).toBe("2026-11-23");
    expect(uaeCalendarDate(DUBAI_MIDNIGHT)).toBe("2026-11-24");
    expect(daysUntilTravel("2026-11-27", BEFORE_DUBAI_MIDNIGHT)).toBe(4);
    expect(daysUntilTravel("2026-11-27", DUBAI_MIDNIGHT)).toBe(3);
  });

  it("recommends Fast Track below the threshold and not on the threshold or after it", () => {
    expect(daysUntilTravel("2026-11-27", DUBAI_MIDNIGHT)).toBe(3);
    expect(daysUntilTravel("2026-11-28", DUBAI_MIDNIGHT)).toBe(4);
    expect(daysUntilTravel("2026-11-29", DUBAI_MIDNIGHT)).toBe(5);
    expect(recommendFastTrack(3, THRESHOLD)).toBe(true);
    expect(recommendFastTrack(4, THRESHOLD)).toBe(false);
    expect(recommendFastTrack(5, THRESHOLD)).toBe(false);
    expect(recommendFastTrack(0, THRESHOLD)).toBe(true);
    expect(recommendFastTrack(null, THRESHOLD)).toBe(false);
  });

  it("crosses the threshold when Dubai midnight moves a 4-day trip to 3 days", () => {
    const travelDate = "2026-11-27";
    expect(recommendFastTrack(daysUntilTravel(travelDate, BEFORE_DUBAI_MIDNIGHT), THRESHOLD)).toBe(false);
    expect(recommendFastTrack(daysUntilTravel(travelDate, DUBAI_MIDNIGHT), THRESHOLD)).toBe(true);
  });

  it("accepts today and the max date, and rejects the day before and the day after", () => {
    const { todayUae, maxTravelDate } = travelDateWindow(DUBAI_MIDNIGHT, 180);
    expect(todayUae).toBe("2026-11-24");
    expect(maxTravelDate).toBe(addCalendarDays("2026-11-24", 180));
    expect(validateTravelDate(todayUae, { required: true, todayUae, maxTravelDate }).ok).toBe(true);
    expect(validateTravelDate(maxTravelDate, { required: true, todayUae, maxTravelDate })).toEqual({
      ok: true,
      date: maxTravelDate,
    });
    expect(validateTravelDate("2026-11-23", { required: true, todayUae, maxTravelDate })).toEqual({
      ok: false,
      code: "past",
    });
    expect(validateTravelDate(addCalendarDays(maxTravelDate, 1), { required: true, todayUae, maxTravelDate })).toEqual({
      ok: false,
      code: "too_far",
    });
    expect(validateTravelDate(null, { required: true, todayUae, maxTravelDate })).toEqual({
      ok: false,
      code: "required",
    });
    expect(validateTravelDate(null, { required: false, todayUae, maxTravelDate })).toEqual({
      ok: true,
      date: null,
    });
    expect(validateTravelDate("2026-02-31", { required: true, todayUae, maxTravelDate })).toEqual({
      ok: false,
      code: "invalid",
    });
  });
});
