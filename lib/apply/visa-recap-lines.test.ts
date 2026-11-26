import { describe, expect, it } from "vitest";
import { groupVisaRecapLines, mixedVisaGroups } from "@/lib/apply/visa-recap-lines";

describe("visa recap lines", () => {
  it("keeps one group when every traveller has the same visa", () => {
    const groups = groupVisaRecapLines([
      { key: "multi", label: "30 Days - Multiple Entry", amountMinor: BigInt(81400) },
      { key: "multi", label: "30 Days - Multiple Entry", amountMinor: BigInt(81400) },
    ]);
    expect(groups).toEqual([
      { key: "multi", label: "30 Days - Multiple Entry", count: 2, amountMinor: BigInt(162800) },
    ]);
    expect(mixedVisaGroups([
      { key: "multi", label: "30 Days - Multiple Entry", amountMinor: BigInt(81400) },
      { key: "multi", label: "30 Days - Multiple Entry", amountMinor: BigInt(81400) },
    ])).toEqual([]);
  });

  it("splits mixed visas into one line per name with its count and price", () => {
    const groups = mixedVisaGroups([
      { key: "multi", label: "30 Days - Multiple Entry", amountMinor: BigInt(81400) },
      { key: "single", label: "30 Days - Single Entry", amountMinor: BigInt(70000) },
      { key: "multi", label: "30 Days - Multiple Entry", amountMinor: BigInt(81400) },
    ]);
    expect(groups).toEqual([
      { key: "multi", label: "30 Days - Multiple Entry", count: 2, amountMinor: BigInt(162800) },
      { key: "single", label: "30 Days - Single Entry", count: 1, amountMinor: BigInt(70000) },
    ]);
  });
});
