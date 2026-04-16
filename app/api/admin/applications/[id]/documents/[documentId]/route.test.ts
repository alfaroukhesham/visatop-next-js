import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "admin-delete-doc" }),
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

function makeTx(foundRow: Record<string, unknown> | null) {
  const audits: Array<Record<string, unknown>> = [];
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (foundRow ? [foundRow] : []),
        }),
      }),
    }),
    insert: () => ({
      values: async (v: Record<string, unknown>) => {
        audits.push(v);
      },
    }),
    delete: () => ({
      where: () => ({
        returning: async () => (foundRow ? [{ id: foundRow.id }] : []),
      }),
    }),
  } as unknown as Parameters<Parameters<typeof actorContext.withAdminDbActor>[1]>[0]["tx"];
  (tx as unknown as { __audits: unknown[] }).__audits = audits;
  return tx;
}

describe("DELETE /api/admin/applications/[id]/documents/[documentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when document missing or belongs to another application", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({
        tx: makeTx(null),
        permissions: ["applications.write", "audit.write"],
      }),
    );
    const res = await DELETE(
      new Request("http://localhost/api/admin/applications/app-1/documents/doc-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "app-1", documentId: "doc-1" }) },
    );
    expect(res.status).toBe(404);
  });

  it("deletes document and writes audit row", async () => {
    const tx = makeTx({
      id: "doc-1",
      applicationId: "app-1",
      documentType: "passport_copy",
      status: "uploaded_temp",
      contentType: "image/jpeg",
      byteLength: 1024,
      sha256: "abc123",
      originalFilename: "passport.jpg",
      createdAt: new Date("2026-04-16T00:00:00Z"),
    });
    vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({ tx, permissions: ["applications.write", "audit.write"] }),
    );
    const res = await DELETE(
      new Request("http://localhost/api/admin/applications/app-1/documents/doc-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "app-1", documentId: "doc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deletedId).toBe("doc-1");
    expect(body.data.applicationId).toBe("app-1");
    const audits = (tx as unknown as { __audits: Array<Record<string, unknown>> }).__audits;
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("application_document.delete");
    expect(audits[0].entityId).toBe("doc-1");
  });
});
