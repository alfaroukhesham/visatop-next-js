import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.1", "x-request-id": "prep-1" }),
}));

vi.mock("@/lib/applications/guest-resume-access", () => ({
  loadGuestApplicationRowByResumeCookie: vi.fn(),
}));

vi.mock("@/lib/applications/guest-link-intent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/applications/guest-link-intent")>();
  return {
    ...actual,
    signGuestLinkIntent: vi.fn(() => "signed-intent-token"),
  };
});

import { loadGuestApplicationRowByResumeCookie } from "@/lib/applications/guest-resume-access";
import { signGuestLinkIntent } from "@/lib/applications/guest-link-intent";
import { __resetGuestLinkRateLimiterForTests } from "@/lib/applications/guest-link-rate-limit";
import { POST } from "./route";

describe("POST /api/apply/prepare-guest-link-intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetGuestLinkRateLimiterForTests();
    vi.stubEnv("GUEST_LINK_AFTER_AUTH_ENABLED", "true");
    vi.stubEnv("GUEST_LINK_INTENT_SECRET", "01234567890123456789012345678901");
  });

  const paidGuestRow = {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    paymentStatus: "paid",
    applicationStatus: "needs_review",
    userId: null,
    isGuest: true,
    adminAttentionRequired: false,
    resumeTokenHash: "h",
  };

  it("returns 200 + prepared + Set-Cookie when guest paid", async () => {
    vi.mocked(loadGuestApplicationRowByResumeCookie).mockResolvedValue(paidGuestRow as never);
    const res = await POST(
      new Request("http://localhost:3000/api/apply/prepare-guest-link-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: "vt_resume=fake",
        },
        body: JSON.stringify({ applicationId: paidGuestRow.id }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ prepared: true, applicationId: paidGuestRow.id });
    expect(res.headers.get("set-cookie")).toContain("vt_link_intent=");
    expect(signGuestLinkIntent).toHaveBeenCalled();
  });

  it("returns 404 without resume cookie", async () => {
    const res = await POST(
      new Request("http://localhost:3000/api/apply/prepare-guest-link-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({ applicationId: paidGuestRow.id }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 503 when GUEST_LINK_INTENT_SECRET is not configured", async () => {
    vi.stubEnv("GUEST_LINK_INTENT_SECRET", "");
    const res = await POST(
      new Request("http://localhost:3000/api/apply/prepare-guest-link-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: "vt_resume=fake",
        },
        body: JSON.stringify({ applicationId: paidGuestRow.id }),
      }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error?.details?.code).toBe("GUEST_LINK_INTENT_NOT_CONFIGURED");
  });

  it("returns 503 when kill switch is false", async () => {
    vi.stubEnv("GUEST_LINK_AFTER_AUTH_ENABLED", "false");
    vi.mocked(loadGuestApplicationRowByResumeCookie).mockResolvedValue(paidGuestRow as never);
    const res = await POST(
      new Request("http://localhost:3000/api/apply/prepare-guest-link-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: "vt_resume=fake",
        },
        body: JSON.stringify({ applicationId: paidGuestRow.id }),
      }),
    );
    expect(res.status).toBe(503);
  });

  it("returns 403 for invalid origin", async () => {
    vi.mocked(loadGuestApplicationRowByResumeCookie).mockResolvedValue(paidGuestRow as never);
    const res = await POST(
      new Request("http://localhost:3000/api/apply/prepare-guest-link-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example",
          Cookie: "vt_resume=fake",
        },
        body: JSON.stringify({ applicationId: paidGuestRow.id }),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.details?.code).toBe("INVALID_ORIGIN");
  });
});
