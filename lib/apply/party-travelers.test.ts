import { describe, expect, it } from "vitest";
import { assertTravelersReady, canAddTraveler, missingTravelerVisaKeys, resolvePartyTravelerServiceId } from "./party-travelers";

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
      assertTravelersReady(
        [
          { key: "primary", kind: "adult" as const, serviceId: "s1" },
          { key: "extra-1", kind: "adult" as const, serviceId: "" },
        ],
        2,
      ),
    ).toEqual({
      ok: false,
      code: "chooseVisaForAll",
      missingKeys: ["extra-1"],
    });
  });

  it("lists every traveller still missing a visa", () => {
    expect(
      missingTravelerVisaKeys([
        { key: "primary", kind: "adult" as const, serviceId: "s1" },
        { key: "a", kind: "adult" as const, serviceId: "" },
        { key: "b", kind: "child" as const, serviceId: "s2" },
        { key: "c", kind: "adult" as const, serviceId: "" },
      ]),
    ).toEqual(["a", "c"]);
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

describe("resolvePartyTravelerServiceId", () => {
  it("auto-selects the only visa so checkout can include that traveller", () => {
    expect(resolvePartyTravelerServiceId([{ id: "only" }], "")).toBe("only");
  });

  it("keeps a valid choice when several visas exist", () => {
    expect(
      resolvePartyTravelerServiceId([{ id: "a" }, { id: "b" }], "b"),
    ).toBe("b");
  });

  it("does not invent a visa when several exist and none is chosen", () => {
    expect(resolvePartyTravelerServiceId([{ id: "a" }, { id: "b" }], "")).toBe("");
  });
});
