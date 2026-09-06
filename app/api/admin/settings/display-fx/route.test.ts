import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "display-fx-test-req" }),
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

vi.mock("@/lib/pricing/fx-usd-aed", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pricing/fx-usd-aed")>(
    "@/lib/pricing/fx-usd-aed",
  );
  return {
    ...actual,
    peekResolvedFxRateFromTx: vi.fn(),
  };
});

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import {
  peekResolvedFxRateFromTx,
  PLATFORM_KEY_FX_AED_PER_USD,
} from "@/lib/pricing/fx-usd-aed";
import { GET, PUT } from "./route";

const jsonRequest = (body: unknown) =>
  new Request("http://localhost/api/admin/settings/display-fx", {
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

function mockUpsertTx(beforeValue: string | undefined, afterValue: string) {
  const selectLimit = vi
    .fn()
    .mockResolvedValue(beforeValue !== undefined ? [{ value: beforeValue }] : []);
  const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });

  const returning = vi.fn().mockResolvedValue([{ key: PLATFORM_KEY_FX_AED_PER_USD, value: afterValue }]);
  const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });

  return {
    select: vi.fn().mockReturnValue({ from: selectFrom }),
    insert,
    _insert: { values, onConflictDoUpdate, returning },
  };
}

describe("GET /api/admin/settings/display-fx", () => {
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

  it("returns setting source from peekResolvedFxRateFromTx", async () => {
    authedWithPermissions(["settings.read"]);
    vi.mocked(peekResolvedFxRateFromTx).mockResolvedValue({
      fxAedPerUsd: "3.6725",
      source: "setting",
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ fxAedPerUsd: "3.6725", source: "setting" });
  });

  it("returns env source when no platform row", async () => {
    authedWithPermissions(["settings.read"]);
    vi.mocked(peekResolvedFxRateFromTx).mockResolvedValue({
      fxAedPerUsd: "3.67",
      source: "env",
    });
    const res = await GET();
    const body = await res.json();
    expect(body.data).toEqual({ fxAedPerUsd: "3.67", source: "env" });
  });

  it("returns missing when neither setting nor env is configured", async () => {
    authedWithPermissions(["settings.read"]);
    vi.mocked(peekResolvedFxRateFromTx).mockResolvedValue({
      fxAedPerUsd: null,
      source: "missing",
    });
    const res = await GET();
    const body = await res.json();
    expect(body.data).toEqual({ fxAedPerUsd: null, source: "missing" });
  });
});

describe("PUT /api/admin/settings/display-fx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no admin session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await PUT(jsonRequest({ fxAedPerUsd: "3.6725" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when settings.write is missing", async () => {
    authedWithPermissions(["settings.read"]);
    const res = await PUT(jsonRequest({ fxAedPerUsd: "3.6725" }));
    expect(res.status).toBe(403);
  });

  it("upserts a valid FX rate and writes audit", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    const tx = mockUpsertTx(undefined, "3.6725");
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: tx as never,
        permissions: ["settings.read", "settings.write", "audit.write"],
      }),
    );

    const res = await PUT(jsonRequest({ fxAedPerUsd: " 3.6725 " }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ fxAedPerUsd: "3.6725", source: "setting" });
    expect(tx.insert).toHaveBeenCalled();
    expect(writeAdminAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "settings.display_fx.update",
        entityType: "platform_setting",
        entityId: PLATFORM_KEY_FX_AED_PER_USD,
      }),
    );
  });

  it("rejects zero", async () => {
    authedWithPermissions(["settings.read", "settings.write", "audit.write"]);
    const res = await PUT(jsonRequest({ fxAedPerUsd: "0" }));
    expect(res.status).toBe(400);
  });

  it("rejects negative values", async () => {
    authedWithPermissions(["settings.read", "settings.write", "audit.write"]);
    const res = await PUT(jsonRequest({ fxAedPerUsd: "-3.67" }));
    expect(res.status).toBe(400);
  });

  it("rejects empty values", async () => {
    authedWithPermissions(["settings.read", "settings.write", "audit.write"]);
    const res = await PUT(jsonRequest({ fxAedPerUsd: "   " }));
    expect(res.status).toBe(400);
  });
});
