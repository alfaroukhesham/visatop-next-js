import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "admin-test-req" }),
}));

vi.mock("@/lib/admin-auth", () => ({
  adminAuth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { GET } from "./route";

describe("GET /api/admin/catalog/eligibility", () => {
  it("returns 401 when there is no admin session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost/api/admin/catalog/eligibility?page=0"));
    expect(res.status).toBe(401);
  });

  it("returns paged eligibility rows", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) => {
      const tx = {} as never;
      return fn({
        tx,
        permissions: ["catalog.read"],
      });
    });

    const listMod = await import("@/lib/admin/catalog/list-catalog-eligibility");
    const spy = vi.spyOn(listMod, "listCatalogEligibility").mockResolvedValue({
      items: [
        {
          serviceId: "svc-1",
          nationalityCode: "US",
          serviceName: "Tourist",
        },
      ],
      total: 1743,
    });

    const res = await GET(
      new Request("http://localhost/api/admin/catalog/eligibility?page=1&pageSize=25"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(1743);
    expect(body.data.page).toBe(1);
    expect(body.data.pageSize).toBe(25);
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 25, offset: 25 }),
    );
    spy.mockRestore();
  });
});
