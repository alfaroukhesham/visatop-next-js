import { describe, expect, it } from "vitest";
import {
  DEFAULT_APPLY_PRICE_BADGES,
  DEFAULT_PARTY_ENABLED,
  DEFAULT_PARTY_MAX_TRAVELERS,
  parseApplyPriceBadges,
  parsePartyEnabled,
  parsePartyMaxTravelers,
} from "./apply-config";

describe("parsePartyEnabled", () => {
  it("parses false", () => {
    expect(parsePartyEnabled("false")).toBe(false);
  });

  it("parses true", () => {
    expect(parsePartyEnabled("true")).toBe(true);
  });

  it("defaults to true for null / empty", () => {
    expect(parsePartyEnabled(null)).toBe(DEFAULT_PARTY_ENABLED);
    expect(parsePartyEnabled("")).toBe(DEFAULT_PARTY_ENABLED);
    expect(parsePartyEnabled(undefined)).toBe(DEFAULT_PARTY_ENABLED);
  });
});

describe("parsePartyMaxTravelers", () => {
  it("parses a valid number", () => {
    expect(parsePartyMaxTravelers("2")).toBe(2);
  });

  it("defaults to 8 for invalid values", () => {
    expect(parsePartyMaxTravelers("0")).toBe(DEFAULT_PARTY_MAX_TRAVELERS);
    expect(parsePartyMaxTravelers("21")).toBe(DEFAULT_PARTY_MAX_TRAVELERS);
    expect(parsePartyMaxTravelers("x")).toBe(DEFAULT_PARTY_MAX_TRAVELERS);
    expect(parsePartyMaxTravelers(null)).toBe(DEFAULT_PARTY_MAX_TRAVELERS);
  });
});

describe("parseApplyPriceBadges", () => {
  it("returns defaults for invalid JSON", () => {
    expect(parseApplyPriceBadges("not json")).toEqual(DEFAULT_APPLY_PRICE_BADGES);
    expect(parseApplyPriceBadges("")).toEqual(DEFAULT_APPLY_PRICE_BADGES);
    expect(parseApplyPriceBadges(null)).toEqual(DEFAULT_APPLY_PRICE_BADGES);
    expect(parseApplyPriceBadges(undefined)).toEqual(DEFAULT_APPLY_PRICE_BADGES);
  });

  it("keeps default noHiddenCharges when only allFeesIncluded is present", () => {
    expect(parseApplyPriceBadges('{"allFeesIncluded":"Inclusive"}')).toEqual({
      allFeesIncluded: "Inclusive",
      noHiddenCharges: DEFAULT_APPLY_PRICE_BADGES.noHiddenCharges,
    });
  });

  it("trims strings and falls back per-field to defaults on empty", () => {
    expect(parseApplyPriceBadges('{"allFeesIncluded":"  Inclusive  ","noHiddenCharges":"  "}')).toEqual({
      allFeesIncluded: "Inclusive",
      noHiddenCharges: DEFAULT_APPLY_PRICE_BADGES.noHiddenCharges,
    });
  });
});
