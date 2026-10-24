import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "local-currency-prices" }),
}));
vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));
vi.mock("@/lib/admin-api/write-admin-audit", () => ({
  writeAdminAudit: vi.fn(),
}));
vi.mock("@/lib/admin/catalog/local-currency-admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/catalog/local-currency-admin")>(
    "@/lib/admin/catalog/local-currency-admin",
  );
  return {
    ...actual,
    listAdminLocalCurrencies: vi.fn(),
    listAdminLocalCurrencyPrices: vi.fn(),
  };
});
vi.mock("@/lib/admin/catalog/apply-local-currency-price-updates", () => ({
  applyLocalCurrencyPriceUiUpdates: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import {
  listAdminLocalCurrencies,
  listAdminLocalCurrencyPrices,
} from "@/lib/admin/catalog/local-currency-admin";
import { applyLocalCurrencyPriceUiUpdates } from "@/lib/admin/catalog/apply-local-currency-price-updates";
import { GET, PUT } from "./route";

const ngn = {
  code: "NGN",
  enabled: true,
  nationalityCodes: ["NG"],
  nationalities: [{ code: "NG", name: "Nigeria" }],
};

const priceRow = {
  serviceId: "svc-1",
  serviceName: "Tourist",
  enabled: true,
  usdMinor: "19900",
  aedMinor: "73000",
  localMinor: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({ tx: {} as never, permissions: ["catalog.read", "catalog.write", "audit.write"] }),
  );
  vi.mocked(listAdminLocalCurrencies).mockResolvedValue([ngn]);
});

describe("GET /api/admin/catalog/local-currencies/[code]/prices", () => {
  it("returns global prices alongside the local column", async () => {
    vi.mocked(listAdminLocalCurrencyPrices).mockResolvedValue([priceRow]);
    const res = await GET(
      new Request("http://localhost/api/admin/catalog/local-currencies/NGN/prices?nationality=NG"),
      { params: Promise.resolve({ code: "NGN" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.rows[0]).toEqual(priceRow);
    expect(listAdminLocalCurrencyPrices).toHaveBeenCalledWith({}, "NGN", "NG");
  });
});

describe("PUT /api/admin/catalog/local-currencies/[code]/prices", () => {
  it("saves stored local prices without FX and audits", async () => {
    vi.mocked(applyLocalCurrencyPriceUiUpdates).mockResolvedValue({
      updated: 1,
      skipped: 0,
      eligibilityAdded: 0,
      eligibilityRemoved: 0,
    });
    vi.mocked(listAdminLocalCurrencyPrices).mockResolvedValue([{ ...priceRow, localMinor: "18500000" }]);
    const res = await PUT(
      new Request("http://localhost/api/admin/catalog/local-currencies/NGN/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nationalityCode: "NG",
          updates: [{ serviceId: "svc-1", amountMajor: "185000.00" }],
        }),
      }),
      { params: Promise.resolve({ code: "NGN" }) },
    );
    expect(res.status).toBe(200);
    expect(applyLocalCurrencyPriceUiUpdates).toHaveBeenCalledWith(
      {},
      {
        nationalityCode: "NG",
        currency: "NGN",
        updates: [{ serviceId: "svc-1", amountMajor: "185000.00" }],
      },
    );
    expect(writeAdminAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ action: "catalog.local_currency.prices.update" }),
    );
  });
});
