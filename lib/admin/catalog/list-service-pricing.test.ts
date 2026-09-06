import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { listServicePricing, previewServicePricing } from "./list-service-pricing";

const FX_ENV = "FX_AED_PER_USD";

const makeTx = (opts: {
  service?: { id: string; name: string } | null;
  nationalities?: Array<{ code: string; name: string; enabled: boolean }>;
  prices?: Array<{
    nationalityCode: string;
    currency: string;
    amountMinor: number;
  }>;
}) => {
  const service = opts.service === undefined ? { id: "svc-1", name: "Tourist" } : opts.service;
  const nationalities = opts.nationalities ?? [
    { code: "IN", name: "India", enabled: true },
    { code: "US", name: "United States", enabled: true },
    { code: "XX", name: "Disabled", enabled: false },
  ];
  const prices = opts.prices ?? [];

  const selectFrom = (table: unknown) => {
    if (table === schema.visaService) {
      return {
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(service ? [service] : [])),
        })),
      };
    }
    if (table === schema.nationality) {
      return {
        orderBy: vi.fn(() => Promise.resolve(nationalities)),
        where: vi.fn(() => Promise.resolve(nationalities.filter((n) => n.enabled))),
      };
    }
    if (table === schema.catalogCustomerPrice) {
      return {
        where: vi.fn(() => Promise.resolve(prices)),
      };
    }
    return {
      where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([])) })),
    };
  };

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(selectFrom),
    })),
  };

  return { tx };
};

describe("listServicePricing", () => {
  beforeEach(() => {
    process.env[FX_ENV] = "3.6725";
  });

  afterEach(() => {
    delete process.env[FX_ENV];
  });

  it("reconstructs groups by matching AED+USD pairs", async () => {
    const { tx } = makeTx({
      prices: [
        { nationalityCode: "IN", currency: "USD", amountMinor: 10000 },
        { nationalityCode: "IN", currency: "AED", amountMinor: 36725 },
        { nationalityCode: "US", currency: "USD", amountMinor: 10000 },
        { nationalityCode: "US", currency: "AED", amountMinor: 36725 },
      ],
    });

    const result = await listServicePricing(tx as never, "svc-1");
    expect(result).not.toBeNull();
    expect(result!.groups).toHaveLength(1);
    expect(result!.groups[0].nationalityCodes.sort()).toEqual(["IN", "US"]);
    expect(result!.groups[0].usdMajor).toBe("100.00");
    expect(result!.groups[0].aedMajor).toBe("367.25");
    expect(result!.groups[0].coversAllEnabled).toBe(true);
  });

  it("keeps a single-currency all-nationalities group", async () => {
    const { tx } = makeTx({
      prices: [
        { nationalityCode: "IN", currency: "AED", amountMinor: 300 },
        { nationalityCode: "US", currency: "AED", amountMinor: 300 },
      ],
    });

    const result = await listServicePricing(tx as never, "svc-1");
    expect(result!.groups).toHaveLength(1);
    expect(result!.groups[0].aedMajor).toBe("3.00");
    expect(result!.groups[0].usdMajor).toBe("");
    expect(result!.groups[0].coversAllEnabled).toBe(true);
  });

  it("returns null when service is missing", async () => {
    const { tx } = makeTx({ service: null });
    const result = await listServicePricing(tx as never, "missing");
    expect(result).toBeNull();
  });
});

describe("previewServicePricing", () => {
  beforeEach(() => {
    process.env[FX_ENV] = "3.6725";
  });

  afterEach(() => {
    delete process.env[FX_ENV];
    delete process.env.NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD;
  });

  it("counts enabled nationalities and price diffs for mode-all preview", async () => {
    const { tx } = makeTx({
      prices: [
        { nationalityCode: "IN", currency: "USD", amountMinor: 10000 },
        { nationalityCode: "IN", currency: "AED", amountMinor: 36725 },
      ],
    });

    const result = await previewServicePricing(tx as never, "svc-1", {
      usdMajor: "200",
    });

    expect(result.enabledNationalityCount).toBe(2);
    expect(result.alreadyPricedCount).toBe(1);
    expect(result.differentPriceCount).toBe(2);
    expect(result.fxConfigured).toBe(true);
    expect(result.settingsHref).toBe("/admin/settings#display-fx");
  });

  it("reports fxConfigured false without inventing sibling when FX missing", async () => {
    delete process.env[FX_ENV];
    const { tx } = makeTx({
      prices: [
        { nationalityCode: "IN", currency: "USD", amountMinor: 10000 },
        { nationalityCode: "IN", currency: "AED", amountMinor: 36725 },
      ],
    });

    const result = await previewServicePricing(tx as never, "svc-1", {
      usdMajor: "200",
    });

    expect(result.fxConfigured).toBe(false);
    expect(result.differentPriceCount).toBe(1);
  });
});
