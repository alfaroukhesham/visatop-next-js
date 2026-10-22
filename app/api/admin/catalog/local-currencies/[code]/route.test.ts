import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "local-currency-code" }),
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
    updateAdminLocalCurrency: vi.fn(),
    deleteAdminLocalCurrency: vi.fn(),
  };
});

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { updateAdminLocalCurrency } from "@/lib/admin/catalog/local-currency-admin";
import { PATCH } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({ tx: {} as never, permissions: ["catalog.read", "catalog.write", "audit.write"] }),
  );
});

describe("PATCH /api/admin/catalog/local-currencies/[code]", () => {
  it("updates nationality links and audits", async () => {
    vi.mocked(updateAdminLocalCurrency).mockResolvedValue({
      code: "NGN",
      enabled: true,
      nationalityCodes: ["NG", "GH"],
      nationalities: [
        { code: "NG", name: "Nigeria" },
        { code: "GH", name: "Ghana" },
      ],
    });
    const res = await PATCH(
      new Request("http://localhost/api/admin/catalog/local-currencies/NGN", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationalityCodes: ["NG", "GH"] }),
      }),
      { params: Promise.resolve({ code: "NGN" }) },
    );
    expect(res.status).toBe(200);
    expect(updateAdminLocalCurrency).toHaveBeenCalledWith(
      {},
      "NGN",
      { nationalityCodes: ["NG", "GH"], enabled: undefined },
    );
    expect(writeAdminAudit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ action: "catalog.local_currency.update", entityId: "NGN" }),
    );
  });
});
