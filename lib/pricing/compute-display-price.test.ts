import { describe, expect, it } from "vitest";
import {
  computeDisplayPriceMinor,
  marginAdditionMinor,
  parsePercentToBasisPoints,
} from "./compute-display-price";

const B = (n: number | string) => BigInt(n);

describe("parsePercentToBasisPoints", () => {
  it("parses whole percent", () => {
    expect(parsePercentToBasisPoints("15")).toBe(B(1500));
  });

  it("parses decimal percent to integer bps", () => {
    expect(parsePercentToBasisPoints("10.5")).toBe(B(1050));
    expect(parsePercentToBasisPoints("0.01")).toBe(B(1));
  });
});

describe("marginAdditionMinor", () => {
  it("percent: truncates toward zero (integer minor)", () => {
    expect(marginAdditionMinor(B(100), "percent", "33")).toBe(B(33));
  });

  it("percent: 10% of 10000 = 1000", () => {
    expect(marginAdditionMinor(B(10000), "percent", "10")).toBe(B(1000));
  });

  it("fixed: adds whole minor units from decimal string", () => {
    expect(marginAdditionMinor(B(5000), "fixed", "199")).toBe(B(199));
    expect(marginAdditionMinor(B(5000), "fixed", "199.7")).toBe(B(200));
  });
});

describe("computeDisplayPriceMinor", () => {
  it("combines reference, percent margin, addons, minus discount", () => {
    const total = computeDisplayPriceMinor({
      referenceMinor: B(10000),
      marginMode: "percent",
      marginValue: "15",
      addonMinorUnits: [B(500), B(250)],
      discountMinor: B(100),
    });
    expect(total.totalMinor).toBe(B(12150));
  });

  it("uses fixed margin addend", () => {
    expect(
      computeDisplayPriceMinor({
        referenceMinor: B(8000),
        marginMode: "fixed",
        marginValue: "500",
        addonMinorUnits: [],
        discountMinor: B(0),
      }).totalMinor,
    ).toBe(B(8500));
  });

  it("discount cannot drive total below zero", () => {
    expect(
      computeDisplayPriceMinor({
        referenceMinor: B(100),
        marginMode: "percent",
        marginValue: "0",
        addonMinorUnits: [],
        discountMinor: B(500),
      }).totalMinor,
    ).toBe(B(0));
  });

  it("default discount 0", () => {
    expect(
      computeDisplayPriceMinor({
        referenceMinor: B(1000),
        marginMode: "percent",
        marginValue: "0",
        addonMinorUnits: [],
      }).totalMinor,
    ).toBe(B(1000));
  });
});
