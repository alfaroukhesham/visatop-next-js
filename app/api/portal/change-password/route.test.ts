import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "portal-change-password-test" }),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      changePassword: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { POST } from "./route";

describe("POST /api/portal/change-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await POST(
      new Request("http://localhost/api/portal/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: "password123", newPassword: "newpassword123" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns ok on successful change", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    (auth.api as any).changePassword = vi.fn().mockResolvedValue({ ok: true });

    const res = await POST(
      new Request("http://localhost/api/portal/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: "password123", newPassword: "newpassword123" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.changed).toBe(true);
  });
});

