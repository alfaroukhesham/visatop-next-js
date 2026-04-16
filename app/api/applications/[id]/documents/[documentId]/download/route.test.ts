import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "download-test" }),
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
import { GET } from "./route";

function req() {
  return new Request(
    "http://localhost/api/applications/app-1/documents/doc-1/download",
    { method: "GET" },
  );
}

describe("GET /api/applications/[id]/documents/[documentId]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when access forbidden", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: false,
      failure: { kind: "forbidden" },
    });
    const res = await GET(req(), {
      params: Promise.resolve({ id: "app-1", documentId: "doc-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-retained documents (temp disallowed)", async () => {
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

  it("streams bytes with attachment disposition on success", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "user", userId: "u1", isGuest: false },
    });
    const bytes = Buffer.from("PDFBYTES");
    vi.mocked(loadDocumentForStream).mockResolvedValue({
      id: "doc-1",
      documentType: "supporting",
      status: "retained",
      contentType: "application/pdf",
      byteLength: bytes.byteLength,
      originalFilename: "proof.pdf",
      bytes,
    });
    const res = await GET(req(), {
      params: Promise.resolve({ id: "app-1", documentId: "doc-1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const received = Buffer.from(await res.arrayBuffer());
    expect(received.toString()).toBe("PDFBYTES");
  });
});
