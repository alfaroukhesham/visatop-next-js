import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "patch-test" }),
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
import { PATCH } from "./route";

describe("PATCH /api/admin/catalog/visa-services/[id]", () => {
  it("rejects empty patch body", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: {} as never,
        permissions: ["catalog.read", "catalog.write", "audit.write"],
      }),
    );

    const res = await PATCH(
      new Request("http://localhost/api/admin/catalog/visa-services/s1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "s1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
