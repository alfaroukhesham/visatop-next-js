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
  resolveAdminPermissions: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { GET, POST } from "./route";

describe("GET /api/admin/catalog/visa-services", () => {
  it("returns 401 when there is no admin session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET();
    expect(res).toBeDefined();
    if (!res) throw new Error("expected response");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when session exists but catalog.read is missing", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) => {
      const tx = {
        select: () => ({
          from: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }),
      };
      return fn({ tx: tx as never, permissions: [] });
    });
    vi.mocked(actorContext.resolveAdminPermissions).mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.details?.missing).toBe("catalog.read");
  });

  it("returns 400 with validation details for invalid POST body", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: {} as never,
        permissions: ["catalog.read", "catalog.write", "audit.write"],
      }),
    );

    const res = await POST(
      new Request("http://localhost/api/admin/catalog/visa-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toMatch(/validation/i);
    expect(body.error.details).toBeDefined();
  });

  it("returns 400 for malformed JSON on POST", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: {} as never,
        permissions: ["catalog.read", "catalog.write", "audit.write"],
      }),
    );

    const res = await POST(
      new Request("http://localhost/api/admin/catalog/visa-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/malformed/i);
  });
});
