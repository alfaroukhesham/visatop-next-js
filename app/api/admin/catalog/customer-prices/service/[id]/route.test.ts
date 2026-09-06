import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "svc-price-test" }),
}));

vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

vi.mock("@/lib/admin/catalog/list-service-pricing", () => ({
  listServicePricing: vi.fn(),
}));

vi.mock("@/lib/admin/catalog/apply-service-price-ui-updates", () => ({
  applyServicePriceUiUpdates: vi.fn(),
  ServicePriceFxMissingError: class ServicePriceFxMissingError extends Error {
    constructor() {
      super("FX is not configured. Open Settings, set AED per 1 USD, then come back.");
      this.name = "ServicePriceFxMissingError";
    }
  },
  ServicePriceValidationError: class ServicePriceValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ServicePriceValidationError";
    }
  },
  FX_SETTINGS_HREF: "/admin/settings#display-fx",
}));

vi.mock("@/lib/admin-api/write-admin-audit", () => ({
  writeAdminAudit: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { listServicePricing } from "@/lib/admin/catalog/list-service-pricing";
import {
  applyServicePriceUiUpdates,
  ServicePriceFxMissingError,
} from "@/lib/admin/catalog/apply-service-price-ui-updates";
import { GET, PUT } from "./route";

const setupAdmin = (permissions: string[]) => {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({
    user: { id: "admin-1" },
  } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({ tx: {} as never, permissions }),
  );
};

describe("GET /api/admin/catalog/customer-prices/service/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "svc-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when service is missing", async () => {
    setupAdmin(["catalog.read"]);
    vi.mocked(listServicePricing).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/admin/catalog/customer-prices/service/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 without catalog.write", async () => {
    setupAdmin(["catalog.read"]);
    const res = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all", usdMajor: "100" }),
      }),
      { params: Promise.resolve({ id: "svc-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 with FX settings message when FX is missing", async () => {
    setupAdmin(["catalog.read", "catalog.write", "audit.write"]);
    vi.mocked(listServicePricing).mockResolvedValue({
      service: { id: "svc-1", name: "Tourist" },
      fxConfigured: false,
      fxAedPerUsd: null,
      groups: [],
      nationalities: [],
    });
    vi.mocked(applyServicePriceUiUpdates).mockRejectedValue(
      new ServicePriceFxMissingError(),
    );
    const res = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all", usdMajor: "100" }),
      }),
      { params: Promise.resolve({ id: "svc-1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe(
      "FX is not configured. Open Settings, set AED per 1 USD, then come back.",
    );
    expect(body.error.details).toEqual({ settingsHref: "/admin/settings#display-fx" });
  });
});
