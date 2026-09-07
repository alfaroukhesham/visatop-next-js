import { describe, expect, it } from "vitest";
import type { TGuidedService } from "./guided-visa-filter";
import {
  defaultEntryForStay,
  filterGuidedServices,
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

  it("falls back to every stay bucket so the first question stays answerable", () => {
    expect(
      stayOptionsForChooser([
        { id: "x", stayBucket: null, entryKind: "either", travelerKind: "adult", showInGuidedChooser: true },
      ]),
    ).toEqual(["1_14", "15_30", "31_60", "transit", "5_year"]);
  });
});

describe("chooser phase", () => {
  it("asks entry then kind for 15_30", () => {
    expect(needsEntryQuestion(catalog, "15_30")).toBe(true);
    expect(needsKindQuestion(catalog, "15_30")).toBe(true);
    expect(nextPhaseAfterStay(catalog, "15_30")).toBe("entry");
    expect(nextPhaseAfterEntry(catalog, "15_30")).toBe("kind");
  });

  it("skips entry and kind for transit", () => {
    expect(needsEntryQuestion(catalog, "transit")).toBe(false);
    expect(needsKindQuestion(catalog, "transit")).toBe(false);
    expect(nextPhaseAfterStay(catalog, "transit")).toBe("results");
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
