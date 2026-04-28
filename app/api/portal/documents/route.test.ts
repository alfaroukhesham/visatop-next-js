import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "portal-documents-test" }),
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

vi.mock("@/lib/documents/normalize-passport-upload", () => ({
  normalizePassportUpload: vi.fn(async () => ({
    bytes: Buffer.from("normalized"),
    sha256: "sha-passport",
    contentType: "image/jpeg",
    byteLength: 10,
  })),
}));

vi.mock("@/lib/documents/normalize-image", () => ({
  normalizeImageBuffer: vi.fn(async () => ({
    bytes: Buffer.from("normalized"),
    sha256: "sha-photo",
    byteLength: 10,
  })),
  NORMALIZED_CONTENT_TYPE: "image/jpeg",
  CorruptImageError: class CorruptImageError extends Error {},
}));

vi.mock("@/lib/documents/normalize-supporting-upload", () => ({
  normalizeSupportingUpload: vi.fn(async () => ({
    bytes: Buffer.from("normalized"),
    sha256: "sha-support",
    contentType: "application/pdf",
    byteLength: 10,
  })),
}));

vi.mock("@/lib/documents/passport-pdf", () => ({
  CorruptPdfError: class CorruptPdfError extends Error {},
  PdfNotSinglePageError: class PdfNotSinglePageError extends Error {},
}));

import { auth } from "@/lib/auth";
import * as actor from "@/lib/db/actor-context";
import { GET as LIST } from "./route";
import { POST as UPLOAD } from "./upload/route";
import { GET as PREVIEW } from "./[id]/preview/route";

describe("portal documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list requires session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await LIST(new Request("http://localhost/api/portal/documents"));
    expect(res.status).toBe(401);
  });

  it("upload requires session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await UPLOAD(new Request("http://localhost/api/portal/documents/upload", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("list returns items", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(actor.withClientDbActor).mockImplementation(async (_uid, fn) =>
      fn({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: async () => [
                  {
                    id: "doc-1",
                    documentType: "passport_copy",
                    supportingCategory: null,
                    originalFilename: null,
                    byteLength: 10,
                    contentType: "image/jpeg",
                    sha256: "sha",
                    createdAt: new Date("2026-01-01T00:00:00.000Z"),
                    expiresAt: null,
                  },
                ],
              }),
            }),
          }),
        }),
      } as never),
    );

    const res = await LIST(new Request("http://localhost/api/portal/documents"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
  });

  it("preview returns bytes with content-type", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(actor.withClientDbActor).mockImplementation(async (_uid, fn) =>
      fn({
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    id: "doc-1",
                    contentType: "image/jpeg",
                    originalFilename: "passport.jpg",
                    bytes: Buffer.from("abc"),
                  },
                ],
              }),
            }),
          }),
        }),
      } as never),
    );

    const res = await PREVIEW(new Request("http://localhost/api/portal/documents/doc-1/preview"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });
});

