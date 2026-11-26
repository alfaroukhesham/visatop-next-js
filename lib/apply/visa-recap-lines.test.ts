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

  it("keeps separate rows when the label matches but the service does not", () => {
    const items = [
      { key: "svc-a", label: "30 Days - Single Entry", amountMinor: BigInt(70000) },
      { key: "svc-b", label: "30 Days - Single Entry", amountMinor: BigInt(70000) },
    ];
    expect(groupVisaRecapLines(items)).toEqual([
      { key: "svc-a", label: "30 Days - Single Entry", count: 1, amountMinor: BigInt(70000) },
      { key: "svc-b", label: "30 Days - Single Entry", count: 1, amountMinor: BigInt(70000) },
    ]);
    expect(mixedVisaGroups(items)).toHaveLength(2);
  });

  it("splits one service when the adult and child amounts differ", () => {
    const items = [
      { key: "svc-a", label: "30 Days - Single Entry", amountMinor: BigInt(81400) },
      { key: "svc-a", label: "30 Days - Single Entry", amountMinor: BigInt(50000) },
    ];
    expect(mixedVisaGroups(items)).toEqual([
      { key: "svc-a", label: "30 Days - Single Entry", count: 1, amountMinor: BigInt(81400) },
      { key: "svc-a", label: "30 Days - Single Entry", count: 1, amountMinor: BigInt(50000) },
    ]);
  });
});
