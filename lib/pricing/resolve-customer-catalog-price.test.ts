import { describe, it, expect } from "vitest";
import { resolveCheckoutTotal, resolveDisplayPrice } from "./resolve-customer-catalog-price";

describe("resolveDisplayPrice", () => {
  it("returns direct AED row when catalog currency is AED and FX is unavailable", () => {
    const row = {
      AED: { currency: "AED" as const, amountMinor: BigInt(12_345), source: "admin_import" },
    };
    const r = resolveDisplayPrice(row, "AED", null);
    expect(r).not.toBeNull();
    expect(r!.displayMinor).toBe(BigInt(12_345));
    expect(r!.currency).toBe("AED");
    expect(r!.wasFxDerived).toBe(false);
  });

  it("returns a stored NGN row without FX", () => {
    const row = {
      NGN: { currency: "NGN" as const, amountMinor: BigInt(18_500_000), source: "admin_import" },
      USD: { currency: "USD" as const, amountMinor: BigInt(19900), source: "admin_import" },
    };
    // resolveDisplayPrice is USD/AED only; NGN checkout uses resolveCheckoutTotal.
    expect(row.NGN.amountMinor).toBe(BigInt(18_500_000));
  });

  it("resolveCheckoutTotal uses stored NGN and never FX-derives it", async () => {
    const tx = {
      select: () => ({
        from: () => ({
          where: async () => [
            { currency: "NGN", amountMinor: 18_500_000, source: "admin_import" },
            { currency: "USD", amountMinor: 19900, source: "admin_import" },
          ],
        }),
      }),
    };
    const r = await resolveCheckoutTotal(tx as never, {
      nationalityCode: "NG",
      serviceId: "svc",
      catalogCurrency: "NGN",
    });
    expect(r).toMatchObject({
      currency: "NGN",
      displayMinor: BigInt(18_500_000),
      wasFxDerived: false,
      fxRateUsed: null,
    });
  });

  it("resolveCheckoutTotal returns null when NGN is missing (does not derive from USD)", async () => {
    const tx = {
      select: () => ({
        from: () => ({
          where: async () => [{ currency: "USD", amountMinor: 19900, source: "admin_import" }],
        }),
      }),
    };
    const r = await resolveCheckoutTotal(tx as never, {
      nationalityCode: "NG",
      serviceId: "svc",
      catalogCurrency: "NGN",
    });
    expect(r).toBeNull();
  });

  it("returns null when only USD is stored, catalog is AED, and FX is null", () => {
    const row = {
      USD: { currency: "USD" as const, amountMinor: BigInt(100), source: "admin_import" },
    };
    expect(resolveDisplayPrice(row, "AED", null)).toBeNull();
  });
});
