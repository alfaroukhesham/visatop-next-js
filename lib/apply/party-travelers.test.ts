import { describe, expect, it } from "vitest";
import { assertTravelersReady, canAddTraveler } from "./party-travelers";

describe("canAddTraveler", () => {
  it("returns false at max", () => {
    expect(canAddTraveler(2, 2)).toBe(false);
  });

  it("returns true below max", () => {
    expect(canAddTraveler(1, 2)).toBe(true);
  });
});

describe("assertTravelersReady", () => {
  it("rejects empty travelers", () => {
    expect(assertTravelersReady([], 2)).toEqual({
      ok: false,
      code: "addAtLeastOne",
    });
  });

  it("rejects empty serviceId", () => {
    expect(
      assertTravelersReady([{ key: "a", kind: "adult" as const, serviceId: "" }], 2),
    ).toEqual({ ok: false, code: "chooseVisaForAll" });
  });

  it("rejects more than max", () => {
    const travelers = [
      { key: "a", kind: "adult" as const, serviceId: "s1" },
      { key: "b", kind: "adult" as const, serviceId: "s2" },
      { key: "c", kind: "adult" as const, serviceId: "s3" },
    ];
    expect(assertTravelersReady(travelers, 2)).toEqual({
      ok: false,
      code: "maxTravelers",
    });
  });

  it("accepts one valid traveler", () => {
    expect(
      assertTravelersReady([{ key: "a", kind: "adult" as const, serviceId: "s1" }], 2),
    ).toEqual({ ok: true });
  });
});
