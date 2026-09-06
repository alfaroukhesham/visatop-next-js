import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "svc-preview-test" }),
}));

vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

vi.mock("@/lib/admin/catalog/list-service-pricing", () => ({
  listServicePricing: vi.fn(),
  previewServicePricing: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { listServicePricing, previewServicePricing } from "@/lib/admin/catalog/list-service-pricing";
import { GET } from "./route";

const setupAdmin = (permissions: string[]) => {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({
    user: { id: "admin-1" },
  } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({ tx: {} as never, permissions }),
  );
};

describe("GET /api/admin/catalog/customer-prices/service/[id]/preview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(
      new Request("http://localhost?usdMajor=100"),
      { params: Promise.resolve({ id: "svc-1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when service is missing", async () => {
    setupAdmin(["catalog.read"]);
    vi.mocked(listServicePricing).mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost?usdMajor=100"),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns preview counts", async () => {
    setupAdmin(["catalog.read"]);
    vi.mocked(listServicePricing).mockResolvedValue({
      service: { id: "svc-1", name: "Tourist" },
      fxConfigured: true,
      fxAedPerUsd: "3.6725",
      groups: [],
      nationalities: [],
    });
    vi.mocked(previewServicePricing).mockResolvedValue({
      enabledNationalityCount: 2,
      alreadyPricedCount: 1,
      differentPriceCount: 2,
      fxConfigured: true,
      settingsHref: "/admin/settings#display-fx",
    });
    const res = await GET(
      new Request("http://localhost?usdMajor=200"),
      { params: Promise.resolve({ id: "svc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.differentPriceCount).toBe(2);
  });
});
