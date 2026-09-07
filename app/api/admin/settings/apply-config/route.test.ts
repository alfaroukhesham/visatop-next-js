import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "apply-config-test-req" }),
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

vi.mock("@/lib/admin-api/write-admin-audit", () => ({
  writeAdminAudit: vi.fn(),
}));

vi.mock("@/lib/apply/apply-config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apply/apply-config")>(
    "@/lib/apply/apply-config",
  );
  return {
    ...actual,
    getApplyConfigFromTx: vi.fn(),
  };
});

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { getApplyConfigFromTx } from "@/lib/apply/apply-config";
import { GET, PUT } from "./route";

const jsonRequest = (body: unknown) =>
  new Request("http://localhost/api/admin/settings/apply-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const authedWithPermissions = (permissions: string[]) => {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({
    user: { id: "admin-1" },
  } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({
      tx: {} as never,
      permissions,
    }),
  );
};

function mockUpsertTx() {
  const returning = vi.fn().mockResolvedValue([{ key: "x", value: "y" }]);
  const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });
  return {
    insert,
    _insert: { values, onConflictDoUpdate, returning },
  };
}

describe("GET /api/admin/settings/apply-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no admin session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when settings.read is missing", async () => {
    authedWithPermissions([]);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns the resolved apply config", async () => {
    authedWithPermissions(["settings.read"]);
    vi.mocked(getApplyConfigFromTx).mockResolvedValue({
      partyEnabled: true,
      partyMaxTravelers: 8,
      badges: { allFeesIncluded: "All fees included", noHiddenCharges: "No hidden charges" },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      partyEnabled: true,
      partyMaxTravelers: 8,
      badges: { allFeesIncluded: "All fees included", noHiddenCharges: "No hidden charges" },
    });
  });
});

describe("PUT /api/admin/settings/apply-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no admin session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await PUT(jsonRequest({ partyEnabled: true }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when settings.write is missing", async () => {
    authedWithPermissions(["settings.read"]);
    const res = await PUT(jsonRequest({ partyEnabled: true }));
    expect(res.status).toBe(403);
  });

  it("rejects when no group is provided", async () => {
    authedWithPermissions(["settings.read", "settings.write", "audit.write"]);
    const res = await PUT(jsonRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects partyMaxTravelers outside 1..20", async () => {
    authedWithPermissions(["settings.read", "settings.write", "audit.write"]);
    const res = await PUT(jsonRequest({ partyMaxTravelers: 21 }));
    expect(res.status).toBe(400);
  });

  it("upserts provided keys and writes audit", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    const tx = mockUpsertTx();
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: tx as never,
        permissions: ["settings.read", "settings.write", "audit.write"],
      }),
    );
    vi.mocked(getApplyConfigFromTx).mockResolvedValue({
      partyEnabled: false,
      partyMaxTravelers: 4,
      badges: { allFeesIncluded: "Inclusive", noHiddenCharges: "No hidden charges" },
    });

    const res = await PUT(jsonRequest({ partyEnabled: true, partyMaxTravelers: 4 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(tx.insert).toHaveBeenCalled();
    expect(writeAdminAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "settings.apply_config.update",
        entityType: "platform_setting",
      }),
    );
  });
});
