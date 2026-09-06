import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "admin-test-req" }),
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
import { DELETE } from "./route";

const mockSession = () => {
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({
    user: { id: "admin-1" },
  } as never);
};

const mockActor = (permissions: string[]) => {
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({ tx: {} as never, permissions }),
  );
};

describe("DELETE /api/admin/catalog/document-types/[key]", () => {
  it("returns 401 when there is no admin session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await DELETE(new Request("http://localhost/api/admin/catalog/document-types/invitation_letter"), {
      params: Promise.resolve({ key: "invitation_letter" }),
    });
    expect(res.status).toBe(401);
  });

  it("deletes the document and audits the removed rules", async () => {
    mockSession();
    mockActor(["catalog.read", "catalog.write", "audit.write"]);
    const typeMod = await import("@/lib/admin/catalog/document-type");
    const deleteSpy = vi.spyOn(typeMod, "deleteCatalogDocumentType").mockResolvedValue({
      key: "invitation_letter",
      label: "Invitation letter",
      deletedRules: 4,
    });
    const auditMod = await import("@/lib/admin-api/write-admin-audit");
    const auditSpy = vi.spyOn(auditMod, "writeAdminAudit").mockResolvedValue(undefined);

    const res = await DELETE(
      new Request("http://localhost/api/admin/catalog/document-types/invitation_letter"),
      { params: Promise.resolve({ key: "invitation_letter" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      key: "invitation_letter",
      label: "Invitation letter",
      deletedRules: 4,
    });
    expect(deleteSpy).toHaveBeenCalledWith(expect.anything(), "invitation_letter");
    expect(auditSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "catalog.document_type.delete",
        entityType: "catalog_document_type",
        entityId: "invitation_letter",
      }),
    );
    deleteSpy.mockRestore();
    auditSpy.mockRestore();
  });

  it("returns 404 when the document is missing", async () => {
    mockSession();
    mockActor(["catalog.read", "catalog.write", "audit.write"]);
    const typeMod = await import("@/lib/admin/catalog/document-type");
    const deleteSpy = vi.spyOn(typeMod, "deleteCatalogDocumentType").mockRejectedValue({
      code: "DOCUMENT_TYPE_NOT_FOUND",
    });

    const res = await DELETE(new Request("http://localhost/api/admin/catalog/document-types/missing_doc"), {
      params: Promise.resolve({ key: "missing_doc" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    deleteSpy.mockRestore();
  });
});
