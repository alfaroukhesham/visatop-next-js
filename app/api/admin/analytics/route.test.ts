import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "admin-analytics-test" }),
}));

vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

vi.mock("@/lib/analytics/admin-analytics-query", () => ({
  loadAdminAnalytics: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { loadAdminAnalytics } from "@/lib/analytics/admin-analytics-query";
import { GET } from "./route";

describe("GET /api/admin/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost/api/admin/analytics"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when from is after to", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    const res = await GET(
      new Request(
        "http://localhost/api/admin/analytics?from=2026-09-15T00:00:00.000Z&to=2026-09-01T00:00:00.000Z",
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns analytics payload for a signed-in admin", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: {} as never,
        permissions: ["applications.read", "payments.read", "catalog.read"],
      }),
    );
    vi.mocked(loadAdminAnalytics).mockResolvedValue({
      range: { from: "2026-09-08T00:00:00.000Z", to: "2026-09-15T00:00:00.000Z" },
      kpis: {
        applicationsCreated: { current: 0, previous: 0, deltaPct: 0 },
        paid: { current: 0, previous: 0, deltaPct: 0 },
        conversionPct: { current: 0, previous: 0, deltaPct: 0 },
        lastPaidAt: null,
      },
      revenue: [],
      churn: { overallAbandonPct: null, biggestDrop: null, abandonedDrafts: 0 },
      funnel: [],
      extraSteps: [],
      weekly: [],
      nationalities: [],
    });
    const res = await GET(
      new Request(
        "http://localhost/api/admin/analytics?from=2026-09-14T20:00:00.000Z&to=2026-09-15T14:42:00.000Z",
      ),
    );
    expect(res.status).toBe(200);
    expect(loadAdminAnalytics).toHaveBeenCalledWith(expect.anything(), {
      from: new Date("2026-09-14T20:00:00.000Z"),
      to: new Date("2026-09-15T14:42:00.000Z"),
    });
  });

  it("returns 403 when analytics read permissions are missing", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({ tx: {} as never, permissions: [] }),
    );
    const res = await GET(
      new Request(
        "http://localhost/api/admin/analytics?from=2026-09-14T20:00:00.000Z&to=2026-09-15T14:42:00.000Z",
      ),
    );
    expect(res.status).toBe(403);
  });
});
