import { describe, expect, it } from "vitest";
import {
  expandPartyInsurance,
  insuranceCatalogOffered,
  insuranceStepOffered,
  nextPartyInsurance,
  normalizeInsuranceForQuote,
} from "./party-insurance";

describe("party insurance", () => {
  it("turns the whole party on from one tick and keeps later travellers on", () => {
    expect(
      nextPartyInsurance({
        memberIds: ["a", "b"],
        stored: { a: false, b: false },
        insuranceForParty: true,
      }),
    ).toEqual({ a: true, b: true });
    expect(expandPartyInsurance(["a", "b", "c"], { a: true, b: true })).toEqual({
      a: true,
      b: true,
      c: true,
    });
  });

  it("treats a mixed legacy selection as all-on, and an empty one as all-off", () => {
    expect(expandPartyInsurance(["a", "b"], { a: true, b: false })).toEqual({ a: true, b: true });
    expect(expandPartyInsurance(["a", "b"], {})).toEqual({ a: false, b: false });
  });

  it("drops a stored selection when insurance is not available", () => {
    expect(
      normalizeInsuranceForQuote({
        memberIds: ["a"],
        stored: { a: true },
        insuranceAvailable: false,
      }),
    ).toEqual({ map: { a: false }, removed: true });
  });

  it("offers the extras step only when the quote lists travel insurance", () => {
    expect(insuranceStepOffered({ availableExtras: [{ key: "travel_insurance" }] })).toBe(true);
    expect(insuranceStepOffered({ availableExtras: [{ key: "fast_track" }] })).toBe(false);
    expect(insuranceStepOffered(null)).toBe(false);
  });

  it("offers Extras on the trip rail when the catalog row is enabled and priced", () => {
    expect(
      insuranceCatalogOffered([
        { key: "travel_insurance", enabled: true, prices: [{ currency: "AED" }] },
      ]),
    ).toBe(true);
    expect(
      insuranceCatalogOffered([{ key: "travel_insurance", enabled: true, prices: [] }]),
    ).toBe(false);
    expect(
      insuranceCatalogOffered([
        { key: "travel_insurance", enabled: false, prices: [{ currency: "AED" }] },
      ]),
    ).toBe(false);
  });
});
