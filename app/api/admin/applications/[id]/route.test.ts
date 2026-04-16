import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "admin-delete-app" }),
}));

vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { DELETE } from "./route";

function makeTx(foundRow: Record<string, unknown> | null) {
  const audits: Array<Parameters<typeof vi.fn>[0]> = [];
  const deletes: string[] = [];

  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (foundRow ? [foundRow] : []),
        }),
      }),
    }),
    insert: () => ({
      values: async (v: Record<string, unknown>) => {
        audits.push(v);
      },
    }),
    delete: () => ({
      where: () => ({
        returning: async () => (foundRow ? [{ id: foundRow.id }] : []),
      }),
    }),
  } as unknown as Parameters<Parameters<typeof actorContext.withAdminDbActor>[1]>[0]["tx"];

  // Helper so tests can inspect `tx` behaviour.
  (tx as unknown as { __audits: unknown[] }).__audits = audits;
  (tx as unknown as { __deletes: string[] }).__deletes = deletes;
  return tx;
}

function setupAdmin(permissions: string[]) {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({
    user: { id: "admin-1" },
  } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(
    async (_id, fn) => fn({ tx: {} as never, permissions }),
  );
}

describe("DELETE /api/admin/applications/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await DELETE(new Request("http://localhost/api/admin/applications/app-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when permission missing", async () => {
    setupAdmin(["applications.read"]);
    const res = await DELETE(new Request("http://localhost/api/admin/applications/app-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when application does not exist", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: makeTx(null),
        permissions: ["applications.write", "audit.write"],
      }),
    );
    const res = await DELETE(new Request("http://localhost/api/admin/applications/app-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes and writes audit log on success", async () => {
    const tx = makeTx({
      id: "app-1",
      userId: "u-1",
      isGuest: false,
      applicationStatus: "draft",
      paymentStatus: "unpaid",
      fulfillmentStatus: "not_started",
      serviceId: "svc-1",
      nationalityCode: "US",
    });
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx,
        permissions: ["applications.write", "audit.write"],
      }),
    );
    const res = await DELETE(new Request("http://localhost/api/admin/applications/app-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deletedId).toBe("app-1");
    const audits = (tx as unknown as { __audits: Array<Record<string, unknown>> }).__audits;
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("application.delete");
    expect(audits[0].entityType).toBe("application");
    expect(audits[0].entityId).toBe("app-1");
    expect(String(audits[0].beforeJson)).toContain("app-1");
  });
});
