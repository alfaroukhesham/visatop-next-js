import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-request-id": "extract-test",
      "x-forwarded-for": "203.0.113.9",
    }),
}));

vi.mock("@/lib/applications/application-access", () => ({
  resolveApplicationAccess: vi.fn(),
}));

vi.mock("@/lib/db/actor-context", () => ({
  withClientDbActor: vi.fn(async (_uid, fn) => fn({} as never)),
  withSystemDbActor: vi.fn(async (fn) => fn({} as never)),
}));

vi.mock("@/lib/ocr/extract-orchestrator", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ocr/extract-orchestrator")>(
    "@/lib/ocr/extract-orchestrator",
  );
  return {
    ...actual,
    acquireExtractionLease: vi.fn(),
    persistExtractionAttempt: vi.fn(async () => undefined),
    finalizeExtraction: vi.fn(),
  };
});

vi.mock("@/lib/ocr/gemini-passport", () => ({
  extractPassport: vi.fn(),
}));

import { resolveApplicationAccess } from "@/lib/applications/application-access";
import {
  acquireExtractionLease,
  finalizeExtraction,
} from "@/lib/ocr/extract-orchestrator";
import { extractPassport } from "@/lib/ocr/gemini-passport";
import { __resetRateLimiterForTests } from "@/lib/applications/document-rate-limit";

import { POST } from "./route";

function makeRequest() {
  return new Request("http://localhost/api/applications/app-1/extract", {
    method: "POST",
  });
}

function okAccess(kind: "user" | "guest" = "user") {
  return vi.mocked(resolveApplicationAccess).mockResolvedValue({
    ok: true,
    access:
      kind === "user"
        ? { kind: "user", userId: "u1", isGuest: false }
        : { kind: "guest", userId: null, isGuest: true },
  });
}

const SNAPSHOT = {
  fullName: null,
  dateOfBirth: null,
  placeOfBirth: null,
  applicantNationality: null,
  passportNumber: null,
  passportExpiryDate: null,
  profession: null,
  address: null,
};

const SUCCESS_OCR = {
  status: "succeeded" as const,
  attempts: [
    {
      attempt: 1 as const,
      status: "succeeded" as const,
      result: {
        schemaVersion: 1 as const,
        fullName: "Ada",
        dateOfBirth: "1815-12-10",
        placeOfBirth: null,
        nationality: "British",
        passportNumber: "X1",
        passportExpiryDate: "2030-01-01",
        profession: null,
        address: null,
      },
      rawText: "{}",
      errorCode: null,
      errorMessage: null,
      missingFields: [],
      latencyMs: 120,
      usage: null,
    },
  ],
  finalResult: {
    schemaVersion: 1 as const,
    fullName: "Ada",
    dateOfBirth: "1815-12-10",
    placeOfBirth: null,
    nationality: "British",
    passportNumber: "X1",
    passportExpiryDate: "2030-01-01",
    profession: null,
    address: null,
  },
  missingFields: [],
  provider: "gemini" as const,
  model: "gemini-2.5-flash",
  promptVersion: 1,
};

describe("POST /api/applications/[id]/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimiterForTests();
  });

  it("returns 409 EXTRACTION_ALREADY_RUNNING when lease acquisition denied", async () => {
    okAccess("user");
    vi.mocked(acquireExtractionLease).mockResolvedValue({
      acquired: false,
      reason: "ALREADY_RUNNING",
    });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("EXTRACTION_ALREADY_RUNNING");
    expect(extractPassport).not.toHaveBeenCalled();
  });

  it("returns 404 NO_PASSPORT_DOCUMENT when no passport copy exists", async () => {
    okAccess("user");
    vi.mocked(acquireExtractionLease).mockResolvedValue({
      acquired: false,
      reason: "NO_PASSPORT_DOCUMENT",
    });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NO_PASSPORT_DOCUMENT");
  });

  it("runs OCR + returns extraction payload on success", async () => {
    okAccess("user");
    vi.mocked(acquireExtractionLease).mockResolvedValue({
      acquired: true,
      runId: 1,
      documentId: "doc-1",
      documentSha256: "sha",
      documentContentType: "image/jpeg",
      documentBytes: Buffer.from("x"),
      applicantProfile: SNAPSHOT,
      provenance: {},
      paymentStatus: "unpaid",
      checkoutState: null,
    });
    vi.mocked(extractPassport).mockResolvedValue(SUCCESS_OCR);
    vi.mocked(finalizeExtraction).mockResolvedValue(true);

    // Second call (inside commitFn) reads uploads + contact then finalize.
    const { withClientDbActor } = await import("@/lib/db/actor-context");
    vi.mocked(withClientDbActor).mockImplementationOnce(async (_uid, fn) => fn({} as never));
    vi.mocked(withClientDbActor).mockImplementationOnce(async (_uid, fn) => {
      const fakeTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                { guestEmail: "e@example.com", phone: "+100", runId: 1 },
              ],
              // For uploads query (no .limit())
            }),
          }),
        }),
      } as never;
      // drizzle chain is too complex; this test focuses on the 409 and success
      // envelope. Use a lightweight stand-in: patch `from().where()` to return
      // an awaitable list for the uploads query path.
      const proxyTx = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === "select") {
              return () => ({
                from: () => {
                  const terminal = {
                    where: () => terminal,
                    limit: async () => [
                      { guestEmail: "e@example.com", phone: "+100", runId: 1 },
                    ],
                    then: (resolve: (v: unknown) => void) =>
                      resolve([
                        { id: "doc-passport", documentType: "passport_copy" },
                        { id: "doc-photo", documentType: "personal_photo" },
                      ]),
                  };
                  return terminal;
                },
              });
            }
            return undefined;
          },
        },
      ) as never;
      return fn(proxyTx);
      void fakeTx;
    });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.extraction.status).toBe("succeeded");
    expect(body.data.extraction.attemptsUsed).toBe(1);
    expect(body.data.extraction.prefill.fullName).toBe("Ada");
    expect(body.data.extraction.prefill.nationality).toBe("British");
  });

  it("returns 409 STALE_EXTRACTION_LEASE when finalize reports runId moved", async () => {
    okAccess("user");
    vi.mocked(acquireExtractionLease).mockResolvedValue({
      acquired: true,
      runId: 1,
      documentId: "doc-1",
      documentSha256: "sha",
      documentContentType: "image/jpeg",
      documentBytes: Buffer.from("x"),
      applicantProfile: SNAPSHOT,
      provenance: {},
      paymentStatus: "unpaid",
      checkoutState: null,
    });
    vi.mocked(extractPassport).mockResolvedValue(SUCCESS_OCR);
    vi.mocked(finalizeExtraction).mockResolvedValue(false);

    const { withClientDbActor } = await import("@/lib/db/actor-context");
    vi.mocked(withClientDbActor).mockImplementationOnce(async (_uid, fn) => fn({} as never));
    vi.mocked(withClientDbActor).mockImplementationOnce(async (_uid, fn) => {
      const proxyTx = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === "select") {
              return () => ({
                from: () => {
                  const terminal = {
                    where: () => terminal,
                    // Simulate runId moved from 1 → 2
                    limit: async () => [
                      { guestEmail: null, phone: null, runId: 2 },
                    ],
                    then: (resolve: (v: unknown) => void) => resolve([]),
                  };
                  return terminal;
                },
              });
            }
            return undefined;
          },
        },
      ) as never;
      return fn(proxyTx);
    });

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ id: "app-1" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("STALE_EXTRACTION_LEASE");
  });
});
