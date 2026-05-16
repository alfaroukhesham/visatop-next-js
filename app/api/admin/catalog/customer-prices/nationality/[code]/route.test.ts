import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "nat-price-test" }),
}));

vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

vi.mock("@/lib/admin/catalog/list-nationality-pricing-rows", () => ({
  listNationalityPricingRows: vi.fn(),
}));

vi.mock("@/lib/admin/catalog/apply-nationality-price-ui-updates", () => ({
  applyNationalityPriceUiUpdates: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { GET, PATCH } from "./route";

function setupAdmin(permissions: string[]) {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({
    user: { id: "admin-1" },
  } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(
    async (_id, fn) => fn({ tx: {} as never, permissions }),
  );
}

describe("GET /api/admin/catalog/customer-prices/nationality/[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid nationality code", async () => {
    setupAdmin(["catalog.read"]);
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ code: "INVALID" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/catalog/customer-prices/nationality/[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 without catalog.write", async () => {
    setupAdmin(["catalog.read"]);
    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: "USD",
          updates: [{ serviceId: "svc-1", amountMajor: "100" }],
        }),
      }),
      { params: Promise.resolve({ code: "AE" }) },
    );
    expect(res.status).toBe(403);
  });
});
