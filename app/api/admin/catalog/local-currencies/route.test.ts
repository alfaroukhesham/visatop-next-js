import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "local-currencies" }),
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
    createAdminLocalCurrency: vi.fn(),
  };
});

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import {
  createAdminLocalCurrency,
  listAdminLocalCurrencies,
} from "@/lib/admin/catalog/local-currency-admin";
import { GET, POST } from "./route";

const ngn = {
  code: "NGN",
  enabled: true,
  nationalityCodes: ["NG"],
  nationalities: [{ code: "NG", name: "Nigeria" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({ tx: {} as never, permissions: ["catalog.read", "catalog.write", "audit.write"] }),
  );
});

describe("GET /api/admin/catalog/local-currencies", () => {
  it("lists local currencies and nationality links", async () => {
    vi.mocked(listAdminLocalCurrencies).mockResolvedValue([ngn]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.localCurrencies).toEqual([ngn]);
  });
});

describe("POST /api/admin/catalog/local-currencies", () => {
  it("creates a local currency and writes audit", async () => {
    vi.mocked(createAdminLocalCurrency).mockResolvedValue(ngn);
    const res = await POST(
      new Request("http://localhost/api/admin/catalog/local-currencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "ngn", nationalityCodes: ["ng"] }),
      }),
    );
    expect(res.status).toBe(201);
    expect(createAdminLocalCurrency).toHaveBeenCalledWith(
      {},
      { code: "NGN", nationalityCodes: ["ng"], enabled: undefined },
    );
    expect(writeAdminAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ action: "catalog.local_currency.create", entityId: "NGN" }),
    );
  });
});
