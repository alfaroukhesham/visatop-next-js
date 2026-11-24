import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "travel-date-test" }),
}));
vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));
vi.mock("@/lib/admin-api/write-admin-audit", () => ({
  writeAdminAudit: vi.fn(),
}));
vi.mock("@/lib/checkout-extras/travel-date-settings", () => ({
  getTravelDateSettingsFromTx: vi.fn(),
  saveTravelDateSettings: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import * as actorContext from "@/lib/db/actor-context";
import { getTravelDateSettingsFromTx, saveTravelDateSettings } from "@/lib/checkout-extras/travel-date-settings";
import { GET, PUT } from "./route";

const settings = {
  fastTrackThresholdDays: 4,
  travelDateRequired: true,
  travelDateMaxDaysAhead: 180,
};

const jsonRequest = (payload: unknown) =>
  new Request("http://localhost/api/admin/settings/travel-date", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({
      tx: { id: "tx" } as never,
      permissions: ["settings.read", "settings.write", "audit.write"],
    }),
  );
});

describe("GET /api/admin/settings/travel-date", () => {
  it("returns 403 when settings.read is missing", async () => {
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({ tx: {} as never, permissions: [] }),
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns the stored settings", async () => {
    vi.mocked(getTravelDateSettingsFromTx).mockResolvedValue(settings);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(settings);
  });
});

describe("PUT /api/admin/settings/travel-date", () => {
  it("returns 403 when settings.write is missing", async () => {
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({ tx: {} as never, permissions: ["settings.read"] }),
    );
    const res = await PUT(jsonRequest(settings));
    expect(res.status).toBe(403);
  });

  it("rejects a threshold above the maximum days ahead", async () => {
    const res = await PUT(
      jsonRequest({ fastTrackThresholdDays: 30, travelDateRequired: true, travelDateMaxDaysAhead: 10 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe(
      "Fast Track threshold must be a whole number from 1 to 60 and cannot be greater than the maximum days ahead.",
    );
    expect(body.error.details).toEqual({ field: "fastTrackThresholdDays" });
    expect(saveTravelDateSettings).not.toHaveBeenCalled();
  });

  it("upserts the settings and writes an audit row", async () => {
    vi.mocked(saveTravelDateSettings).mockResolvedValue({ before: settings, after: settings });
    const res = await PUT(jsonRequest(settings));
    expect(res.status).toBe(200);
    expect(saveTravelDateSettings).toHaveBeenCalledWith(expect.anything(), settings);
    expect(writeAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "settings.travel_date.update",
        entityType: "platform_setting",
        entityId: "fast_track_threshold_days",
      }),
    );
  });
});
