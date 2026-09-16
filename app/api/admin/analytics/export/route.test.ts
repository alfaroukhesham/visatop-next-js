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
  loadApplicantsForExport: vi.fn(),
}));

vi.mock("@/lib/admin-api/write-admin-audit", () => ({
  writeAdminAudit: vi.fn().mockResolvedValue(undefined),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { loadApplicantsForExport, loadFunnelEventsForExport } from "@/lib/analytics/admin-analytics-query";
import { GET } from "./route";

const withReadPerms = () =>
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({
      tx: {} as never,
      permissions: ["applications.read", "payments.read", "catalog.read"],
    }),
  );

const withApplicantExportPerms = () =>
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({
      tx: {} as never,
      permissions: ["applications.read", "payments.read", "catalog.read", "audit.write"],
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

  it("returns 403 for applicants export when audit.write is missing", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    withReadPerms();
    const res = await GET(
      new Request("http://localhost/api/admin/analytics/export?kind=applicants"),
    );
    expect(res.status).toBe(403);
  });

  it("exports one CSV row per applicant when kind=applicants", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    withApplicantExportPerms();
    vi.mocked(loadApplicantsForExport).mockResolvedValue({
      truncated: false,
      rows: [
        {
          email: "ada@example.com",
          createdAt: "2026-09-14T10:00:00.000Z",
          paid: "yes",
          amountPaid: "1.00 AED",
          visaType: "30 Days",
          lastStep: "Passport uploaded",
        },
      ],
    });
    const res = await GET(
      new Request("http://localhost/api/admin/analytics/export?kind=applicants"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("analytics-applicants.csv");
    const body = await res.text();
    expect(body).toContain("ada@example.com");
    expect(body).toContain("1.00 AED");
    expect(body).toContain("Passport uploaded");
    expect(writeAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "analytics.applicants_export" }),
    );
  });

  it("marks the applicants CSV truncated in the file body", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    withApplicantExportPerms();
    vi.mocked(loadApplicantsForExport).mockResolvedValue({
      truncated: true,
      rows: [],
    });
    const res = await GET(
      new Request("http://localhost/api/admin/analytics/export?kind=applicants"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Export-Truncated")).toBe("true");
    const body = await res.text();
    expect(body).toContain("truncated,true");
  });
});
