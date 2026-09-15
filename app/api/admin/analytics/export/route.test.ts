import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "admin-analytics-export-test" }),
}));

vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

vi.mock("@/lib/analytics/admin-analytics-query", () => ({
  ANALYTICS_EVENTS_EXPORT_LIMIT: 20000,
  loadAdminAnalytics: vi.fn(),
  loadFunnelEventsForExport: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { loadFunnelEventsForExport } from "@/lib/analytics/admin-analytics-query";
import { GET } from "./route";

const withReadPerms = () =>
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({
      tx: {} as never,
      permissions: ["applications.read", "payments.read", "catalog.read"],
    }),
  );

describe("GET /api/admin/analytics/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost/api/admin/analytics/export?kind=events"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when analytics read permissions are missing", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({ tx: {} as never, permissions: [] }),
    );
    const res = await GET(
      new Request("http://localhost/api/admin/analytics/export?kind=events"),
    );
    expect(res.status).toBe(403);
  });

  it("sets X-Export-Truncated when the event export is capped", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    withReadPerms();
    vi.mocked(loadFunnelEventsForExport).mockResolvedValue({
      truncated: true,
      rows: [],
    });
    const res = await GET(
      new Request("http://localhost/api/admin/analytics/export?kind=events"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Export-Truncated")).toBe("true");
    const body = await res.text();
    expect(body).toContain("truncated,true");
  });
});
