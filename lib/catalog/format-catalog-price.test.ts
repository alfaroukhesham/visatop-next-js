import { describe, expect, it } from "vitest";
import {
  catalogCurrencyTab,
  formatDisplayMinor,
  sumCatalogServicesTotalMinor,
} from "./format-catalog-price";

describe("catalog display totals", () => {
  it("keeps the selected catalog currency, including local NGN", () => {
    expect(catalogCurrencyTab("ngn")).toBe("NGN");
    expect(catalogCurrencyTab("AED")).toBe("AED");
    expect(catalogCurrencyTab("")).toBe("USD");

    const total = sumCatalogServicesTotalMinor(
      [{ id: "svc-1", displayPriceMinor: "18500000", currency: "NGN" }],
      ["svc-1"],
      "NGN",
    );
    expect(total).toBe(BigInt(18_500_000));
    expect(formatDisplayMinor(total!.toString(), "NGN")).toContain("185");
    expect(formatDisplayMinor(total!.toString(), "NGN")).not.toMatch(/USD|AED/);
  });

  it("does not coerce a local currency total onto USD", () => {
    expect(
      sumCatalogServicesTotalMinor(
        [{ id: "svc-1", displayPriceMinor: "18500000", currency: "NGN" }],
        ["svc-1"],
        "USD",
      ),
    ).toBeNull();
  });
});
