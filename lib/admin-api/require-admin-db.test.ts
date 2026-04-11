import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "fk-test-rid" }),
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
import { runAdminDbJson } from "./require-admin-db";

describe("runAdminDbJson", () => {
  it("maps Postgres FK violation to VALIDATION_ERROR", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: {} as never,
        permissions: ["catalog.read", "catalog.write", "audit.write"],
      }),
    );

    const res = await runAdminDbJson("fk-test-rid", ["catalog.read"], async () => {
      const err = new Error("fk");
      (err as { cause?: unknown }).cause = { code: "23503" };
      throw err;
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
