import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-request-id": "doc-upload-test",
      "x-forwarded-for": "203.0.113.9",
    }),
}));

vi.mock("@/lib/applications/application-access", () => ({
  resolveApplicationAccess: vi.fn(),
}));

vi.mock("@/lib/applications/document-upload", async () => {
  const actual = await vi.importActual<typeof import("@/lib/applications/document-upload")>(
    "@/lib/applications/document-upload",
  );
  return {
    ...actual,
    persistUploadedDocument: vi.fn(),
  };
});

vi.mock("@/lib/db/actor-context", () => ({
  withClientDbActor: vi.fn(async (_uid, fn) => fn({} as never)),
  withSystemDbActor: vi.fn(async (fn) => fn({} as never)),
}));

vi.mock("@/lib/documents/normalize-image", async () => {
  const actual = await vi.importActual<typeof import("@/lib/documents/normalize-image")>(
    "@/lib/documents/normalize-image",
  );
  return {
    ...actual,
    normalizeImageBuffer: vi.fn(async () => ({
      bytes: Buffer.from("jpg-normalized"),
      sha256: "sha-img",
      contentType: "image/jpeg" as const,
      byteLength: 14,
      width: 100,
      height: 100,
    })),
  };
});

vi.mock("@/lib/documents/normalize-passport-upload", () => ({
  normalizePassportUpload: vi.fn(async () => ({
    bytes: Buffer.from("jpg-passport"),
    sha256: "sha-passport",
    contentType: "image/jpeg" as const,
    byteLength: 12,
    width: 100,
    height: 100,
    sourceContentType: "image/jpeg",
    renderedFromPdf: false,
  })),
}));

vi.mock("@/lib/documents/normalize-supporting-upload", () => ({
  normalizeSupportingUpload: vi.fn(async () => ({
    bytes: Buffer.from("jpg-supporting"),
    sha256: "sha-supporting",
    contentType: "image/jpeg" as const,
    byteLength: 14,
    width: 100,
    height: 100,
    sourceContentType: "image/jpeg",
    storedAsIs: false,
  })),
}));

import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { persistUploadedDocument } from "@/lib/applications/document-upload";
import {
  __resetRateLimiterForTests,
  RATE_LIMITS,
  consume,
} from "@/lib/applications/document-rate-limit";

import { POST } from "./route";

function makeDocRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "doc-1",
    applicationId: "app-1",
    storageKey: null,
    mimeType: null,
    sizeBytes: null,
    extractionStatus: null,
    documentType: "passport_copy",
    status: "uploaded_temp",
    contentType: "image/jpeg",
    byteLength: 12,
    originalFilename: "passport.jpg",
    sha256: "sha-passport",
    createdAt: new Date("2026-04-16T00:00:00Z"),
    ...overrides,
  };
}

function buildRequest(form: FormData, contentLength?: number) {
  const init: RequestInit & { headers: Record<string, string> } = {
    method: "POST",
    headers: {},
    body: form,
  };
  if (contentLength !== undefined) init.headers["content-length"] = String(contentLength);
  return new Request("http://localhost/api/applications/app-1/documents/upload", init);
}

describe("POST /api/applications/[id]/documents/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimiterForTests();
  });

  it("returns 403 when access resolver reports forbidden", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: false,
      failure: { kind: "forbidden" },
    });
    const form = new FormData();
    form.set("documentType", "passport_copy");
    form.set("file", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    const res = await POST(buildRequest(form), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 when access resolver reports not_found", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: false,
      failure: { kind: "not_found" },
    });
    const form = new FormData();
    form.set("documentType", "passport_copy");
    form.set("file", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    const res = await POST(buildRequest(form), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects invalid documentType with 400", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "user", userId: "u1", isGuest: false },
    });
    const form = new FormData();
    form.set("documentType", "bogus");
    form.set("file", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    const res = await POST(buildRequest(form), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects empty file with 400", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "user", userId: "u1", isGuest: false },
    });
    const form = new FormData();
    form.set("documentType", "passport_copy");
    form.set("file", new File([], "a.jpg", { type: "image/jpeg" }));
    const res = await POST(buildRequest(form), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects oversize declared content-length with 413", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "user", userId: "u1", isGuest: false },
    });
    const form = new FormData();
    form.set("documentType", "passport_copy");
    form.set("file", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    const res = await POST(buildRequest(form, 50 * 1024 * 1024), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("rejects disallowed mime for personal_photo with 415", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "user", userId: "u1", isGuest: false },
    });
    const form = new FormData();
    form.set("documentType", "personal_photo");
    form.set("file", new File(["%PDF"], "a.pdf", { type: "application/pdf" }));
    const res = await POST(buildRequest(form), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error.code).toBe("UNSUPPORTED_TYPE");
  });

  it("returns 201 with normalized metadata on successful passport_copy upload", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "user", userId: "u1", isGuest: false },
    });
    vi.mocked(persistUploadedDocument).mockResolvedValue({
      ok: true,
      document: makeDocRow(),
      replacedPriorId: null,
      wasIdempotent: false,
    });
    const form = new FormData();
    form.set("documentType", "passport_copy");
    form.set("file", new File(["jpegbytes"], "passport.jpg", { type: "image/jpeg" }));
    const res = await POST(buildRequest(form), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.document.documentType).toBe("passport_copy");
    expect(body.data.document.sha256).toBe("sha-passport");
    expect(body.data.replaced).toBe(false);
    expect(body.data.idempotent).toBe(false);
  });

  it("returns 200 on idempotent same-sha re-upload", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "user", userId: "u1", isGuest: false },
    });
    vi.mocked(persistUploadedDocument).mockResolvedValue({
      ok: true,
      document: makeDocRow(),
      replacedPriorId: null,
      wasIdempotent: true,
    });
    const form = new FormData();
    form.set("documentType", "passport_copy");
    form.set("file", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    const res = await POST(buildRequest(form), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.idempotent).toBe(true);
  });

  it("returns 409 CHECKOUT_FROZEN when persist reports frozen", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "user", userId: "u1", isGuest: false },
    });
    vi.mocked(persistUploadedDocument).mockResolvedValue({
      ok: false,
      error: { code: "CHECKOUT_FROZEN" },
    });
    const form = new FormData();
    form.set("documentType", "passport_copy");
    form.set("file", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    const res = await POST(buildRequest(form), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CHECKOUT_FROZEN");
  });

  it("applies rate limit for guest callers and returns 429 when exhausted", async () => {
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "guest", userId: null, isGuest: true },
    });
    vi.mocked(persistUploadedDocument).mockResolvedValue({
      ok: true,
      document: makeDocRow(),
      replacedPriorId: null,
      wasIdempotent: false,
    });

    // Saturate bucket first.
    const { limit } = RATE_LIMITS.UPLOAD_PREVIEW;
    for (let i = 0; i < limit; i++) {
      consume("UPLOAD_PREVIEW", { ip: "203.0.113.9", applicationId: "app-1" });
    }

    const form = new FormData();
    form.set("documentType", "passport_copy");
    form.set("file", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    const res = await POST(buildRequest(form), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(res.headers.get("retry-after")).toBeTruthy();
  });
});
