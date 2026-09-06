import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "del-nat" }),
}));
vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { DELETE } from "./route";
import {
  CatalogDeleteBlockedError,
  CatalogEntityNotFoundError,
} from "@/lib/admin/catalog/delete-catalog-entity";

vi.mock("@/lib/admin/catalog/delete-catalog-entity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/catalog/delete-catalog-entity")>(
    "@/lib/admin/catalog/delete-catalog-entity",
  );
  return { ...actual, deleteCatalogNationality: vi.fn() };
});

vi.mock("@/lib/admin-api/write-admin-audit", () => ({
  writeAdminAudit: vi.fn(),
}));

import { deleteCatalogNationality } from "@/lib/admin/catalog/delete-catalog-entity";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";

const authed = () => {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({ tx: {} as never, permissions: ["catalog.read", "catalog.write", "audit.write"] }),
  );
};

describe("DELETE /api/admin/catalog/nationalities/[code]", () => {
  it("returns 401 without a session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/nationalities/IN"), {
      params: Promise.resolve({ code: "IN" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 409 when applications still use the nationality", async () => {
    authed();
    vi.mocked(deleteCatalogNationality).mockRejectedValue(
      new CatalogDeleteBlockedError(
        "This nationality is used on applications. Disable it instead of deleting.",
      ),
    );
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/nationalities/IN"), {
      params: Promise.resolve({ code: "IN" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 404 when missing", async () => {
    authed();
    vi.mocked(deleteCatalogNationality).mockRejectedValue(new CatalogEntityNotFoundError());
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/nationalities/ZZ"), {
      params: Promise.resolve({ code: "ZZ" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when catalog.write is missing", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({ tx: {} as never, permissions: ["catalog.read"] }),
    );
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/nationalities/IN"), {
      params: Promise.resolve({ code: "IN" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("deletes an unused nationality and writes an audit row", async () => {
    authed();
    vi.mocked(deleteCatalogNationality).mockResolvedValue({
      code: "IN",
      name: "India",
      enabled: true,
    } as never);
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/nationalities/IN"), {
      params: Promise.resolve({ code: "IN" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.deleted).toEqual({ code: "IN" });
    expect(writeAdminAudit).toHaveBeenCalledTimes(1);
    expect(writeAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "catalog.nationality.delete", entityId: "IN" }),
    );
  });
});
