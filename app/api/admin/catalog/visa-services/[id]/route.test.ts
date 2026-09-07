import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "patch-test" }),
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

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { PATCH, DELETE } from "./route";
import {
  CatalogDeleteBlockedError,
  CatalogEntityNotFoundError,
} from "@/lib/admin/catalog/delete-catalog-entity";

vi.mock("@/lib/admin/catalog/delete-catalog-entity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/catalog/delete-catalog-entity")>(
    "@/lib/admin/catalog/delete-catalog-entity",
  );
  return { ...actual, deleteCatalogVisaService: vi.fn() };
});

vi.mock("@/lib/admin-api/write-admin-audit", () => ({
  writeAdminAudit: vi.fn(),
}));

import { deleteCatalogVisaService } from "@/lib/admin/catalog/delete-catalog-entity";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";

const authed = () => {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({
    user: { id: "admin-1" },
  } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({
      tx: {} as never,
      permissions: ["catalog.read", "catalog.write", "audit.write"],
    }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/admin/catalog/visa-services/[id]", () => {
  it("rejects empty patch body", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: {} as never,
        permissions: ["catalog.read", "catalog.write", "audit.write"],
      }),
    );

    const res = await PATCH(
      new Request("http://localhost/api/admin/catalog/visa-services/s1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "s1" }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("persists guided-choice fields and returns them", async () => {
    const setMock = vi.fn().mockReturnThis();
    const whereMock = vi.fn().mockReturnThis();
    const returningMock = vi.fn().mockResolvedValue([
      {
        id: "s1",
        name: "Tourist",
        enabled: true,
        durationDays: 30,
        entries: "single",
        stayBucket: "transit",
        entryKind: "either",
        travelerKind: "adult",
        showInGuidedChooser: true,
      },
    ]);
    const updateMock = vi.fn().mockReturnValue({
      set: setMock,
      where: whereMock,
      returning: returningMock,
    });
    const tx = { update: updateMock } as never;

    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx,
        permissions: ["catalog.read", "catalog.write", "audit.write"],
      }),
    );

    const res = await PATCH(
      new Request("http://localhost/api/admin/catalog/visa-services/s1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stayBucket: "transit", travelerKind: "adult" }),
      }),
      { params: Promise.resolve({ id: "s1" }) },
    );

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ stayBucket: "transit", travelerKind: "adult" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.service.stayBucket).toBe("transit");
    expect(body.data.service.travelerKind).toBe("adult");
    expect(writeAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "catalog.visa_service.update",
        afterJson: expect.stringContaining('"stayBucket":"transit"'),
      }),
    );
  });
});

describe("DELETE /api/admin/catalog/visa-services/[id]", () => {
  it("returns 401 without a session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/visa-services/s1"), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 409 when applications still use the service", async () => {
    authed();
    vi.mocked(deleteCatalogVisaService).mockRejectedValue(
      new CatalogDeleteBlockedError(
        "This service is used on applications. Disable it instead of deleting.",
      ),
    );
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/visa-services/s1"), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 404 when the service is missing", async () => {
    authed();
    vi.mocked(deleteCatalogVisaService).mockRejectedValue(new CatalogEntityNotFoundError());
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/visa-services/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when catalog.write is missing", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({
      user: { id: "admin-1" },
    } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: {} as never,
        permissions: ["catalog.read"],
      }),
    );
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/visa-services/s1"), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("deletes an unused service and writes an audit row", async () => {
    authed();
    vi.mocked(deleteCatalogVisaService).mockResolvedValue({
      id: "s1",
      name: "Tourist",
      enabled: true,
    } as never);
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/visa-services/s1"), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.deleted).toEqual({ id: "s1" });
    expect(writeAdminAudit).toHaveBeenCalledTimes(1);
    expect(writeAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "catalog.visa_service.delete", entityId: "s1" }),
    );
  });
});
