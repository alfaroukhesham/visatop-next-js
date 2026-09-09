import { describe, expect, it } from "vitest";
import type { TGuidedService } from "./guided-visa-filter";
import {
  defaultEntryForStay,
  defaultKindForStay,
  filterGuidedServices,
  filterPartyVisaOptions,
  needsEntryQuestion,
  needsKindQuestion,
  nextPhaseAfterEntry,
  nextPhaseAfterStay,
  stayOptionsForChooser,
  visibleStayBuckets,
} from "./guided-visa-filter";

const catalog: TGuidedService[] = [
  { id: "b", stayBucket: "15_30", entryKind: "single", travelerKind: "adult", showInGuidedChooser: true },
  { id: "c", stayBucket: "15_30", entryKind: "multiple", travelerKind: "adult", showInGuidedChooser: true },
  { id: "d", stayBucket: "15_30", entryKind: "single", travelerKind: "child", showInGuidedChooser: true },
  { id: "e", stayBucket: "transit", entryKind: "either", travelerKind: "adult", showInGuidedChooser: true },
  { id: "hidden", stayBucket: "15_30", entryKind: "single", travelerKind: "adult", showInGuidedChooser: false },
  { id: "incomplete", stayBucket: null, entryKind: "either", travelerKind: "adult", showInGuidedChooser: true },
];

describe("filterGuidedServices", () => {
  it("returns 30-day single adult only", () => {
    expect(
      filterGuidedServices(catalog, { stay: "15_30", entry: "single", kind: "adult" }).map((s) => s.id),
    ).toEqual(["b"]);
  });

  it("hides incomplete and opted-out rows", () => {
    expect(
      filterGuidedServices(catalog, { stay: "15_30", entry: "single", kind: "adult" }).map((s) => s.id),
    ).not.toContain("hidden");
    expect(
      filterGuidedServices(catalog, { stay: "15_30", entry: "single", kind: "adult" }).map((s) => s.id),
    ).not.toContain("incomplete");
  });

  it("transit stay returns e and not b", () => {
    expect(
      filterGuidedServices(catalog, { stay: "transit", entry: "single", kind: "adult" }).map((s) => s.id),
    ).toEqual(["e"]);
  });

  it("child 15_30 single returns d", () => {
    expect(
      filterGuidedServices(catalog, { stay: "15_30", entry: "single", kind: "child" }).map((s) => s.id),
    ).toEqual(["d"]);
  });
});

describe("visibleStayBuckets", () => {
  it("returns buckets present in the catalog", () => {
    expect(visibleStayBuckets(catalog)).toEqual(["15_30", "transit"]);
  });
});

describe("stayOptionsForChooser", () => {
  it("uses catalog buckets when any stay is configured", () => {
    expect(stayOptionsForChooser(catalog)).toEqual(["15_30", "transit"]);
  });

  it("does not invent stay buckets when none are configured", () => {
    expect(
      stayOptionsForChooser([
        { id: "x", stayBucket: null, entryKind: "either", travelerKind: "adult", showInGuidedChooser: true },
      ]),
    ).toEqual([]);
  });
});

describe("chooser phase", () => {
  it("asks entry then kind for 15_30", () => {
    expect(needsEntryQuestion(catalog, "15_30")).toBe(true);
    expect(needsKindQuestion(catalog, "15_30")).toBe(true);
    expect(nextPhaseAfterStay(catalog, "15_30")).toBe("entry");
    expect(nextPhaseAfterEntry(catalog, "15_30", "single")).toBe("kind");
  });

  it("skips entry and kind for transit", () => {
    expect(needsEntryQuestion(catalog, "transit")).toBe(false);
    expect(needsKindQuestion(catalog, "transit")).toBe(false);
    expect(nextPhaseAfterStay(catalog, "transit")).toBe("results");
  });

  it("skips kind when only child visas exist so the shortlist is not empty", () => {
    const childOnly: TGuidedService[] = [
      {
        id: "kid",
        stayBucket: "1_14",
        entryKind: "single",
        travelerKind: "child",
        showInGuidedChooser: true,
      },
    ];
    expect(needsKindQuestion(childOnly, "1_14")).toBe(false);
    expect(defaultKindForStay(childOnly, "1_14")).toBe("child");
    expect(nextPhaseAfterStay(childOnly, "1_14")).toBe("results");
  });

  it("defaults entry to multiple when that is the only stay option", () => {
    const fiveYear: TGuidedService[] = [
      {
        id: "five",
        stayBucket: "5_year",
        entryKind: "multiple",
        travelerKind: "adult",
        showInGuidedChooser: true,
      },
    ];
    expect(needsEntryQuestion(fiveYear, "5_year")).toBe(false);
    expect(defaultEntryForStay(fiveYear, "5_year")).toBe("multiple");
    expect(
      filterGuidedServices(fiveYear, {
        stay: "5_year",
        entry: defaultEntryForStay(fiveYear, "5_year"),
        kind: "adult",
      }).map((s) => s.id),
    ).toEqual(["five"]);
  });
});

describe("filterPartyVisaOptions", () => {
  it("keeps both single and multiple entry visas for the stay and traveller kind", () => {
    expect(
      filterPartyVisaOptions(catalog, { stay: "15_30", kind: "adult" }).map((s) => s.id),
    ).toEqual(["b", "c"]);
  });
});
