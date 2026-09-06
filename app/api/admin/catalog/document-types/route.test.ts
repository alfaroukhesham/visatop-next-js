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
import { GET, POST } from "./route";

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

describe("GET /api/admin/catalog/document-types", () => {
  it("returns 401 when there is no admin session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("lists documents", async () => {
    mockSession();
    mockActor(["catalog.read"]);
    const typeMod = await import("@/lib/admin/catalog/document-type");
    const spy = vi.spyOn(typeMod, "listCatalogDocumentTypes").mockResolvedValue([
      {
        key: "bank_statement_6m",
        label: "Last 6 months bank account statement",
        description: "",
        acceptMime: "image/jpeg,image/png,application/pdf",
        pairCount: 3,
      },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.documents).toHaveLength(1);
    expect(body.data.documents[0].key).toBe("bank_statement_6m");
    spy.mockRestore();
  });
});

describe("POST /api/admin/catalog/document-types", () => {
  it("creates a document and audits", async () => {
    mockSession();
    mockActor(["catalog.read", "catalog.write", "audit.write"]);
    const typeMod = await import("@/lib/admin/catalog/document-type");
    const createSpy = vi.spyOn(typeMod, "createCatalogDocumentType").mockResolvedValue({
      key: "invitation_letter",
      label: "Invitation letter",
      description: "",
      acceptMime: "image/jpeg,image/png,application/pdf",
      pairCount: 0,
    });
    const auditMod = await import("@/lib/admin-api/write-admin-audit");
    const auditSpy = vi.spyOn(auditMod, "writeAdminAudit").mockResolvedValue(undefined);

    const res = await POST(
      new Request("http://localhost/api/admin/catalog/document-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Invitation letter" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.document.key).toBe("invitation_letter");
    expect(auditSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "catalog.document_type.create" }),
    );
    createSpy.mockRestore();
    auditSpy.mockRestore();
  });
});
