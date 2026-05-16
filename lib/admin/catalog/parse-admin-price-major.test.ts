import { describe, expect, it } from "vitest";
import { parseAdminPriceMajorInput } from "./apply-nationality-price-ui-updates";

describe("parseAdminPriceMajorInput", () => {
  it("parses decimal major units to minor", () => {
    expect(parseAdminPriceMajorInput("419.00")).toBe(41900n);
    expect(parseAdminPriceMajorInput("550,00")).toBe(55000n);
  });

  it("returns null for empty or invalid", () => {
    expect(parseAdminPriceMajorInput("")).toBeNull();
    expect(parseAdminPriceMajorInput("   ")).toBeNull();
    expect(parseAdminPriceMajorInput("abc")).toBeNull();
    expect(parseAdminPriceMajorInput("0")).toBeNull();
  });
});
