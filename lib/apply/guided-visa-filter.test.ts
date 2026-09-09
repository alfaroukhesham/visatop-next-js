import { describe, expect, it } from "vitest";
import type { TGuidedService } from "./guided-visa-filter";
import {
  defaultEntryForStay,
  defaultKindForStay,
  entryOptionsForStay,
  filterGuidedServices,
  filterPartyVisaOptions,
  kindOptionsForStay,
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

  it("skips entry for transit (no single/multiple SKU) but still asks adult vs child", () => {
    expect(entryOptionsForStay(catalog, "transit")).toEqual([]);
    expect(needsEntryQuestion(catalog, "transit")).toBe(false);
    expect(kindOptionsForStay(catalog, "transit")).toEqual(["adult"]);
    expect(needsKindQuestion(catalog, "transit")).toBe(true);
    expect(nextPhaseAfterStay(catalog, "transit")).toBe("kind");
  });

  it("still asks entry then kind when only a child SKU exists", () => {
    const childOnly: TGuidedService[] = [
      {
        id: "kid",
        stayBucket: "1_14",
        entryKind: "single",
        travelerKind: "child",
        showInGuidedChooser: true,
      },
    ];
    expect(entryOptionsForStay(childOnly, "1_14")).toEqual(["single"]);
    expect(kindOptionsForStay(childOnly, "1_14", "single")).toEqual(["child"]);
    expect(needsKindQuestion(childOnly, "1_14", "single")).toBe(true);
    expect(defaultKindForStay(childOnly, "1_14")).toBe("child");
    expect(nextPhaseAfterStay(childOnly, "1_14")).toBe("entry");
    expect(nextPhaseAfterEntry(childOnly, "1_14", "single")).toBe("kind");
  });

  it("asks the entry question when multiple is the only frequency", () => {
    const fiveYear: TGuidedService[] = [
      {
        id: "five",
        stayBucket: "5_year",
        entryKind: "multiple",
        travelerKind: "adult",
        showInGuidedChooser: true,
      },
    ];
    expect(entryOptionsForStay(fiveYear, "5_year")).toEqual(["multiple"]);
    expect(kindOptionsForStay(fiveYear, "5_year", "multiple")).toEqual(["adult"]);
    expect(needsEntryQuestion(fiveYear, "5_year")).toBe(true);
    expect(defaultEntryForStay(fiveYear, "5_year")).toBe("multiple");
    expect(nextPhaseAfterStay(fiveYear, "5_year")).toBe("entry");
    expect(
      filterGuidedServices(fiveYear, {
        stay: "5_year",
        entry: defaultEntryForStay(fiveYear, "5_year"),
        kind: "adult",
      }).map((s) => s.id),
    ).toEqual(["five"]);
  });

  it("walks stay then entry then kind for a single 30-day single-entry adult SKU", () => {
    const oneVisa: TGuidedService[] = [
      {
        id: "only",
        stayBucket: "15_30",
        entryKind: "single",
        travelerKind: "adult",
        showInGuidedChooser: true,
      },
    ];
    expect(stayOptionsForChooser(oneVisa)).toEqual(["15_30"]);
    expect(entryOptionsForStay(oneVisa, "15_30")).toEqual(["single"]);
    expect(kindOptionsForStay(oneVisa, "15_30", "single")).toEqual(["adult"]);
    expect(nextPhaseAfterStay(oneVisa, "15_30")).toBe("entry");
    expect(nextPhaseAfterEntry(oneVisa, "15_30", "single")).toBe("kind");
  });
});

describe("filterPartyVisaOptions", () => {
  it("keeps both single and multiple entry visas for the stay and traveller kind", () => {
    expect(
      filterPartyVisaOptions(catalog, { stay: "15_30", kind: "adult" }).map((s) => s.id),
    ).toEqual(["b", "c"]);
  });
});
