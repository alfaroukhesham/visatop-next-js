import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "health-test" }),
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns 200 without touching the database (blue-green wait_healthy)", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      data: { status: "ok" },
      meta: { requestId: "health-test" },
    });
    expect(res.headers.get("x-request-id")).toBe("health-test");
  });
});
