import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-request-id": "preview-test",
      "x-forwarded-for": "203.0.113.9",
    }),
}));

vi.mock("@/lib/applications/application-access", () => ({
  resolveApplicationAccess: vi.fn(),
}));

vi.mock("@/lib/applications/document-fetch", async () => {
  const actual = await vi.importActual<typeof import("@/lib/applications/document-fetch")>(
    "@/lib/applications/document-fetch",
  );
  return { ...actual, loadDocumentForStream: vi.fn() };
});

vi.mock("@/lib/db/actor-context", () => ({
  withClientDbActor: vi.fn(async (_uid, fn) => fn({} as never)),
  withSystemDbActor: vi.fn(async (fn) => fn({} as never)),
}));

import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { loadDocumentForStream } from "@/lib/applications/document-fetch";
import { __resetRateLimiterForTests } from "@/lib/applications/document-rate-limit";
import { POST as UPLOAD_POST } from "../../upload/route";
import { GET } from "./route";

void UPLOAD_POST; // ensure test collector picks up related routes (no-op).

function req() {
  return new Request(
    "http://localhost/api/applications/app-1/documents/doc-1/preview",
    { method: "GET" },
  );
}

describe("GET /api/applications/[id]/documents/[documentId]/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimiterForTests();
  });

  it("returns 403 when access denied", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: false,
      failure: { kind: "forbidden" },
    });
    const res = await GET(req(), {
      params: Promise.resolve({ id: "app-1", documentId: "doc-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when document missing or deleted", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "user", userId: "u1", isGuest: false },
    });
    vi.mocked(loadDocumentForStream).mockResolvedValue(null);
    const res = await GET(req(), {
      params: Promise.resolve({ id: "app-1", documentId: "doc-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("streams bytes with correct headers on success", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "user", userId: "u1", isGuest: false },
    });
    const bytes = Buffer.from("JPEG_BYTES");
    vi.mocked(loadDocumentForStream).mockResolvedValue({
      id: "doc-1",
      documentType: "passport_copy",
      status: "uploaded_temp",
      contentType: "image/jpeg",
      byteLength: bytes.byteLength,
      originalFilename: "passport.jpg",
      bytes,
    });
    const res = await GET(req(), {
      params: Promise.resolve({ id: "app-1", documentId: "doc-1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-disposition")).toContain("inline");
    const received = Buffer.from(await res.arrayBuffer());
    expect(received.toString()).toBe("JPEG_BYTES");
  });
});
