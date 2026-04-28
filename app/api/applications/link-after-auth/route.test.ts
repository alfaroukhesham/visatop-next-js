import { beforeEach, describe, expect, it, vi } from "vitest";

const resumeTokenTest = vi.hoisted(() => ({
  verifyResumeToken: vi.fn(),
}));

vi.mock("@/lib/applications/resume-token", () => ({
  verifyResumeToken: (plain: string, hash: string) => resumeTokenTest.verifyResumeToken(plain, hash),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.2", "x-request-id": "link-1" }),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

const withSystemMock = vi.fn();
vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: (...args: unknown[]) => withSystemMock(...args),
}));

import { auth } from "@/lib/auth";
import { signGuestLinkIntent } from "@/lib/applications/guest-link-intent";
import { __resetGuestLinkRateLimiterForTests } from "@/lib/applications/guest-link-rate-limit";
import { POST } from "./route";

const appId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

function baseGuestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: appId,
    userId: null,
    isGuest: true,
    guestEmail: "guest@test.com",
    paymentStatus: "paid",
    applicationStatus: "needs_review",
    resumeTokenHash: "stored-hash",
    adminAttentionRequired: false,
    ...overrides,
  };
}

/**
 * @param updateReturning — `undefined` = one row updated (id from first selected row); `[]` = lost race.
 */
function txMock(rowList: unknown[], updateReturning?: { id: string }[]) {
  const first = rowList[0] as { id?: string } | undefined;
  const defaultReturning = first?.id ? [{ id: first.id }] : [];
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  return {
    __inserts: inserts,
    select: (shape?: unknown) => {
      // shape present => vault ingestion select; otherwise link select-for-update.
      if (shape) {
        return {
          from: () => ({
            innerJoin: () => ({
              where: async () => [
                {
                  documentType: "passport_copy",
                  contentType: "image/jpeg",
                  byteLength: 10,
                  originalFilename: "passport.jpg",
                  sha256: "sha",
                  bytes: Buffer.from("abc"),
                },
              ],
            }),
          }),
        };
      }
      return {
        from: () => ({
          where: () => ({
            for: () => ({
              limit: async () => rowList,
            }),
          }),
        }),
      };
    },
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () =>
            updateReturning !== undefined ? updateReturning : defaultReturning,
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (v: unknown) => {
        inserts.push({ table, values: v });
        return {
          onConflictDoNothing: () => ({
            returning: async () => [{ id: "udoc-1" }],
          }),
        };
      },
    }),
  };
}

describe("POST /api/applications/link-after-auth", () => {
  let intent: string;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetGuestLinkRateLimiterForTests();
    vi.stubEnv("GUEST_LINK_AFTER_AUTH_ENABLED", "true");
    vi.stubEnv("GUEST_LINK_INTENT_SECRET", "01234567890123456789012345678901");
    intent = signGuestLinkIntent(appId, {
      secret: "01234567890123456789012345678901",
      nowSec: Math.floor(Date.now() / 1000),
    });
    resumeTokenTest.verifyResumeToken.mockReset();
    resumeTokenTest.verifyResumeToken.mockReturnValue(true);
  });

  it("returns 503 when kill switch is false", async () => {
    vi.stubEnv("GUEST_LINK_AFTER_AUTH_ENABLED", "false");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", email: "a@test.com" },
    } as never);
    const res = await POST(
      new Request("http://localhost:3000/api/applications/link-after-auth", {
        method: "POST",
        headers: { Origin: "http://localhost:3000" },
      }),
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 without session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await POST(
      new Request("http://localhost:3000/api/applications/link-after-auth", {
        method: "POST",
        headers: { Origin: "http://localhost:3000", Cookie: `vt_link_intent=${encodeURIComponent(intent)}` },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 422 when intent cookie missing and clears intent cookie", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", email: "a@test.com" },
    } as never);
    const res = await POST(
      new Request("http://localhost:3000/api/applications/link-after-auth", {
        method: "POST",
        headers: { Origin: "http://localhost:3000", Cookie: "vt_resume=x" },
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.details?.code).toBe("GUEST_LINK_INTENT_INVALID");
    expect(res.headers.get("set-cookie")).toContain("vt_link_intent=");
  });

  it("returns 200 alreadyLinked when owner non-guest", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", email: "a@test.com" },
    } as never);
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(
        txMock([
          {
            ...baseGuestRow(),
            userId: "user-1",
            isGuest: false,
            guestEmail: "a@test.com",
            resumeTokenHash: null,
          },
        ]),
      );
    });
    const res = await POST(
      new Request("http://localhost:3000/api/applications/link-after-auth", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: `vt_link_intent=${encodeURIComponent(intent)}; vt_resume=plain`,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.alreadyLinked).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("vt_link_intent=");
  });

  it("returns 403 LINK_RESUME_REQUIRED without vt_resume and clears intent", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", email: "a@test.com" },
    } as never);
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(txMock([baseGuestRow()]));
    });
    const res = await POST(
      new Request("http://localhost:3000/api/applications/link-after-auth", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: `vt_link_intent=${encodeURIComponent(intent)}`,
        },
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.details?.code).toBe("LINK_RESUME_REQUIRED");
    expect(res.headers.get("set-cookie")).toContain("vt_link_intent=");
  });

  it("returns 403 LINK_INTENT_RESUME_MISMATCH when resume does not verify", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", email: "a@test.com" },
    } as never);
    resumeTokenTest.verifyResumeToken.mockReturnValue(false);
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(txMock([baseGuestRow()]));
    });
    const res = await POST(
      new Request("http://localhost:3000/api/applications/link-after-auth", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: `vt_link_intent=${encodeURIComponent(intent)}; vt_resume=wrong`,
        },
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.details?.code).toBe("LINK_INTENT_RESUME_MISMATCH");
    expect(res.headers.get("set-cookie")).toContain("vt_link_intent=");
  });

  it("returns 409 LINK_NOT_ALLOWED when matrix blocks (unpaid)", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", email: "a@test.com" },
    } as never);
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(txMock([baseGuestRow({ paymentStatus: "unpaid" })]));
    });
    const res = await POST(
      new Request("http://localhost:3000/api/applications/link-after-auth", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: `vt_link_intent=${encodeURIComponent(intent)}; vt_resume=ok`,
        },
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error?.details?.code).toBe("LINK_NOT_ALLOWED");
    expect(res.headers.get("set-cookie")).toContain("vt_link_intent=");
  });

  it("returns 409 LINK_NOT_ALLOWED for other owner", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", email: "a@test.com" },
    } as never);
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(
        txMock([
          {
            ...baseGuestRow(),
            userId: "user-2",
            isGuest: false,
            resumeTokenHash: null,
          },
        ]),
      );
    });
    const res = await POST(
      new Request("http://localhost:3000/api/applications/link-after-auth", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: `vt_link_intent=${encodeURIComponent(intent)}; vt_resume=x`,
        },
      }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error?.details?.code).toBe("LINK_NOT_ALLOWED");
    expect(res.headers.get("set-cookie")).toContain("vt_link_intent=");
  });

  it("returns 409 when update loses race (empty returning) and clears intent", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", email: "a@test.com" },
    } as never);
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(txMock([baseGuestRow()], []));
    });
    const res = await POST(
      new Request("http://localhost:3000/api/applications/link-after-auth", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: `vt_link_intent=${encodeURIComponent(intent)}; vt_resume=ok`,
        },
      }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error?.details?.code).toBe("LINK_NOT_ALLOWED");
    expect(res.headers.get("set-cookie")).toContain("vt_link_intent=");
  });

  it("returns 404 when row missing after valid intent and clears intent", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", email: "a@test.com" },
    } as never);
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(txMock([]));
    });
    const res = await POST(
      new Request("http://localhost:3000/api/applications/link-after-auth", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: `vt_link_intent=${encodeURIComponent(intent)}; vt_resume=ok`,
        },
      }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("set-cookie")).toContain("vt_link_intent=");
  });

  it("ingests eligible application documents into vault on link", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", email: "a@test.com" },
    } as never);

    const tx = txMock([baseGuestRow({ paymentStatus: "paid" })]);
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));

    const res = await POST(
      new Request("http://localhost:3000/api/applications/link-after-auth", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
          Cookie: `vt_link_intent=${encodeURIComponent(intent)}; vt_resume=ok`,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // We should have attempted at least one insert (audit_log + user_document + user_document_blob).
    expect(tx.__inserts.length).toBeGreaterThanOrEqual(2);
  });
});
