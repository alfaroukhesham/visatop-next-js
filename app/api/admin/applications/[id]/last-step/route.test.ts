import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "admin-last-step" }),
}));

vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

vi.mock("@/lib/applications/load-application-last-step", () => ({
  loadApplicationLastStepView: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { loadApplicationLastStepView } from "@/lib/applications/load-application-last-step";
import { GET } from "./route";

const lastStep = {
  fieldLabel: "Stopped at",
  value: "Passport upload",
  secondary: "2 hours ago · 11/5/2026, 4:00:00 PM\nLast activity 1 hour ago · 11/5/2026, 5:00:00 PM",
};

const setupAdmin = (permissions: string[]) => {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({
    user: { id: "admin-1" },
  } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({ tx: { __writes: 0 } as never, permissions }),
  );
};

describe("GET /api/admin/applications/[id]/last-step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost/api/admin/applications/app-1/last-step"), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(401);
    expect(loadApplicationLastStepView).not.toHaveBeenCalled();
  });

  it("returns 403 when applications.read is missing", async () => {
    setupAdmin(["payments.read"]);
    const res = await GET(new Request("http://localhost/api/admin/applications/app-1/last-step"), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(403);
    expect(loadApplicationLastStepView).not.toHaveBeenCalled();
  });

  it("returns 404 when the application is missing", async () => {
    setupAdmin(["applications.read"]);
    vi.mocked(loadApplicationLastStepView).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/admin/applications/missing/last-step"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns the last-step view with no-store and does not write", async () => {
    const tx = { __writes: 0 };
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({ tx: tx as never, permissions: ["applications.read"] }),
    );
    vi.mocked(loadApplicationLastStepView).mockResolvedValue(lastStep);

    const res = await GET(new Request("http://localhost/api/admin/applications/app-1/last-step"), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(lastStep);
    expect(loadApplicationLastStepView).toHaveBeenCalledWith(tx, "app-1");
    expect(tx.__writes).toBe(0);
  });
});
