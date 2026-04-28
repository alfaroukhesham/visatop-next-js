import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "portal-doc-delete-test" }),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withClientDbActor: vi.fn(),
}));

import { auth } from "@/lib/auth";
import * as actor from "@/lib/db/actor-context";
import { DELETE } from "./route";

describe("DELETE /api/portal/documents/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await DELETE(new Request("http://localhost/api/portal/documents/doc-1"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 200 when deleted", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(actor.withClientDbActor).mockImplementation(async (_uid, fn) =>
      fn({
        delete: () => ({
          where: () => ({
            returning: async () => [{ id: "doc-1" }],
          }),
        }),
      } as never),
    );

    const res = await DELETE(new Request("http://localhost/api/portal/documents/doc-1"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.deleted).toBe(true);
  });
});

