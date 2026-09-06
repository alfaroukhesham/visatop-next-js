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
import { DELETE, GET, POST } from "./route";
import { POST as previewPOST } from "./preview/route";

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

const jsonRequest = (url: string, method: string, body: unknown) =>
  new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("GET /api/admin/catalog/document-requirements", () => {
  it("returns 401 when there is no admin session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost/api/admin/catalog/document-requirements"));
    expect(res.status).toBe(401);
  });

  it("returns grouped countries for the picker", async () => {
    mockSession();
    mockActor(["catalog.read"]);
    const listMod = await import("@/lib/admin/catalog/list-eligibility-by-nationality");
    const spy = vi.spyOn(listMod, "listEligibilityByNationality").mockResolvedValue([
      {
        code: "IN",
        name: "India",
        services: [
          { id: "svc-1", name: "Tourist", hasPrice: false },
          { id: "svc-2", name: "Business", hasPrice: true },
        ],
      },
      {
        code: "FR",
        name: "France",
        services: [{ id: "svc-3", name: "Student", hasPrice: true }],
      },
    ]);

    const res = await GET(
      new Request("http://localhost/api/admin/catalog/document-requirements?picker=1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.countries).toHaveLength(2);
    const [inCountry, frCountry] = body.data.countries;
    expect(inCountry.code).toBe("IN");
    expect(inCountry.services).toHaveLength(2);
    expect(inCountry.services[0].hasPrice).toBe(false);
    expect(frCountry.code).toBe("FR");
    expect(frCountry.services).toHaveLength(1);
    spy.mockRestore();
  });

  it("returns countries that already have this document assigned", async () => {
    mockSession();
    mockActor(["catalog.read"]);
    const listMod = await import("@/lib/admin/catalog/list-catalog-document-requirement-countries");
    const spy = vi.spyOn(listMod, "listCatalogDocumentRequirementCountries").mockResolvedValue([
      { code: "IN", name: "India", serviceCount: 8 },
      { code: "EG", name: "Egypt", serviceCount: 3 },
    ]);

    const res = await GET(
      new Request(
        "http://localhost/api/admin/catalog/document-requirements?group=countries&documentType=bank_statement_6m",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.countries).toEqual([
      { code: "IN", name: "India", serviceCount: 8 },
      { code: "EG", name: "Egypt", serviceCount: 3 },
    ]);
    expect(spy).toHaveBeenCalledWith(expect.anything(), "bank_statement_6m");
    spy.mockRestore();
  });
});

describe("POST /api/admin/catalog/document-requirements/preview", () => {
  it("returns preview without writing", async () => {
    mockSession();
    mockActor(["catalog.read"]);
    const assignMod = await import("@/lib/admin/catalog/document-requirement-assign");
    const previewSpy = vi
      .spyOn(assignMod, "previewDocumentRequirementAssign")
      .mockResolvedValue({
        willCreateEligibility: 2,
        pairCount: 3,
        alreadyEligible: 1,
        pairsWithoutPrice: 1,
        alreadyHasDocument: 0,
        willInsert: 3,
        willUpdateRole: 0,
      });
    const assignSpy = vi.spyOn(assignMod, "assignDocumentRequirements");
    const removeSpy = vi.spyOn(assignMod, "removeDocumentRequirements");

    const res = await previewPOST(
      jsonRequest(
        "http://localhost/api/admin/catalog/document-requirements/preview",
        "POST",
        {
          documentType: "bank_statement_6m",
          role: "required",
          pairs: [{ nationalityCode: "IN", serviceId: "svc-1" }],
        },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.willCreateEligibility).toBe(2);
    expect(body.data.pairCount).toBe(3);
    expect(body.data.alreadyEligible).toBe(1);
    expect(body.data.pairsWithoutPrice).toBe(1);
    expect(body.data.alreadyHasDocument).toBe(0);
    expect(body.data.willInsert).toBe(3);
    expect(body.data.willUpdateRole).toBe(0);
    expect(assignSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
    previewSpy.mockRestore();
    assignSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe("POST /api/admin/catalog/document-requirements", () => {
  it("returns 403 when catalog.write is missing", async () => {
    mockSession();
    mockActor(["catalog.read"]);
    const res = await POST(
      jsonRequest("http://localhost/api/admin/catalog/document-requirements", "POST", {
        documentType: "bank_statement_6m",
        role: "required",
        pairs: [{ nationalityCode: "IN", serviceId: "svc-1" }],
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.details?.missing).toBe("catalog.write");
  });

  it("assigns only the listed pairs and audits bulk_assign", async () => {
    mockSession();
    mockActor(["catalog.read", "catalog.write", "audit.write"]);
    const assignMod = await import("@/lib/admin/catalog/document-requirement-assign");
    const assignSpy = vi
      .spyOn(assignMod, "assignDocumentRequirements")
      .mockResolvedValue({ pairCount: 2, eligibilityCreated: 2, upserted: 2 });
    const auditMod = await import("@/lib/admin-api/write-admin-audit");
    const auditSpy = vi.spyOn(auditMod, "writeAdminAudit").mockResolvedValue(undefined);

    const pairs = [
      { nationalityCode: "IN", serviceId: "svc-1" },
      { nationalityCode: "FR", serviceId: "svc-2" },
    ];
    const res = await POST(
      jsonRequest("http://localhost/api/admin/catalog/document-requirements", "POST", {
        documentType: "bank_statement_6m",
        role: "required",
        pairs,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.pairCount).toBe(2);
    expect(assignSpy).toHaveBeenCalledTimes(1);
    const received = assignSpy.mock.calls[0][1];
    expect(received.pairs).toHaveLength(2);
    expect(received.pairs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nationalityCode: "IN", serviceId: "svc-1" }),
        expect.objectContaining({ nationalityCode: "FR", serviceId: "svc-2" }),
      ]),
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "catalog.document_requirement.bulk_assign" }),
    );
    assignSpy.mockRestore();
    auditSpy.mockRestore();
  });

  it("returns 400 for too many pairs without calling the domain", async () => {
    mockSession();
    mockActor(["catalog.read", "catalog.write", "audit.write"]);
    const assignMod = await import("@/lib/admin/catalog/document-requirement-assign");
    const assignSpy = vi.spyOn(assignMod, "assignDocumentRequirements");
    const pairs = Array.from({ length: 2001 }, (_, i) => ({
      nationalityCode: "IN",
      serviceId: `svc-${i}`,
    }));
    const res = await POST(
      jsonRequest("http://localhost/api/admin/catalog/document-requirements", "POST", {
        documentType: "bank_statement_6m",
        role: "required",
        pairs,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(assignSpy).not.toHaveBeenCalled();
    assignSpy.mockRestore();
  });
});

describe("DELETE /api/admin/catalog/document-requirements", () => {
  it("bulk removes document requirements without deleting eligibility", async () => {
    mockSession();
    mockActor(["catalog.read", "catalog.write", "audit.write"]);
    const assignMod = await import("@/lib/admin/catalog/document-requirement-assign");
    const removeSpy = vi
      .spyOn(assignMod, "removeDocumentRequirements")
      .mockResolvedValue({ deleted: 2 });
    const auditMod = await import("@/lib/admin-api/write-admin-audit");
    const auditSpy = vi.spyOn(auditMod, "writeAdminAudit").mockResolvedValue(undefined);

    const res = await DELETE(
      jsonRequest("http://localhost/api/admin/catalog/document-requirements", "DELETE", {
        documentType: "bank_statement_6m",
        pairs: [{ nationalityCode: "IN", serviceId: "svc-1" }],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.deleted).toBe(2);
    expect(removeSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ documentType: "bank_statement_6m" }),
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "catalog.document_requirement.bulk_remove" }),
    );
    removeSpy.mockRestore();
    auditSpy.mockRestore();
  });

  it("returns 404 for a missing single id", async () => {
    mockSession();
    mockActor(["catalog.read", "catalog.write", "audit.write"]);
    const assignMod = await import("@/lib/admin/catalog/document-requirement-assign");
    const removeOneSpy = vi
      .spyOn(assignMod, "removeOneDocumentRequirement")
      .mockRejectedValue({ code: "DOCUMENT_REQUIREMENTS_NOT_FOUND" });

    const res = await DELETE(
      jsonRequest("http://localhost/api/admin/catalog/document-requirements", "DELETE", {
        id: "missing",
      }),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("DOCUMENT_REQUIREMENTS_NOT_FOUND");
    removeOneSpy.mockRestore();
  });
});
