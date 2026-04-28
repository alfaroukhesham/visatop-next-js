import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "attach-from-vault-test" }),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withClientDbActor: vi.fn(),
}));

vi.mock("@/lib/applications/document-upload", () => ({
  persistUploadedDocument: vi.fn(async () => ({
    ok: true,
    document: {
      id: "adoc-1",
      applicationId: "app-1",
      documentType: "passport_copy",
      status: "uploaded_temp",
      sha256: "sha",
      contentType: "image/jpeg",
      byteLength: 10,
      originalFilename: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    replacedPriorId: null,
    wasIdempotent: false,
  })),
  toPublicDocument: vi.fn(
    (row: {
      id: string;
      documentType: string;
      status: string;
      sha256: string;
      contentType: string;
      byteLength: number;
      originalFilename: string | null;
      createdAt: Date;
    }) => ({
      id: row.id,
      documentType: row.documentType,
      status: row.status,
      sha256: row.sha256,
      contentType: row.contentType,
      byteLength: row.byteLength,
      originalFilename: row.originalFilename,
      createdAt: row.createdAt.toISOString(),
    }),
  ),
}));

import { auth } from "@/lib/auth";
import * as actor from "@/lib/db/actor-context";
import { POST } from "./route";

describe("POST /api/applications/:id/documents/attach-from-vault", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await POST(
      new Request("http://localhost/api/applications/app-1/documents/attach-from-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDocumentId: "doc-1" }),
      }),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("attaches vault doc to application", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);

    vi.mocked(actor.withClientDbActor).mockImplementation(async (_uid, fn) =>
      fn({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ id: "app-1" }],
            }),
            innerJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    id: "doc-1",
                    documentType: "passport_copy",
                    supportingCategory: null,
                    contentType: "image/jpeg",
                    byteLength: 10,
                    originalFilename: null,
                    sha256: "sha",
                    bytes: Buffer.from("abc"),
                  },
                ],
              }),
            }),
          }),
        }),
        insert: () => ({
          values: () => ({
            onConflictDoNothing: () => ({}),
          }),
        }),
      } as never),
    );

    const res = await POST(
      new Request("http://localhost/api/applications/app-1/documents/attach-from-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userDocumentId: "doc-1" }),
      }),
      { params: Promise.resolve({ id: "app-1" }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.document.id).toBe("adoc-1");
  });
});

