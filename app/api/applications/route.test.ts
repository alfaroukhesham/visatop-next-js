import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "app-create-test" }),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => void) => {
      fn();
    },
  };
});

vi.mock("@/lib/email/send-admin-notification-emails", () => ({
  sendAdminStep2ServiceSelectedEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: vi.fn(),
}));

vi.mock("@/lib/applications/create-party-draft", () => ({
  createPartyDraft: vi.fn(),
  CreatePartyDraftValidationError: class extends Error {},
}));

import { auth } from "@/lib/auth";
import * as actor from "@/lib/db/actor-context";
import { createPartyDraft, CreatePartyDraftValidationError } from "@/lib/applications/create-party-draft";
import { POST } from "./route";

const guestRow = {
  id: "app-1",
  referenceNumber: null,
  applicationStatus: "draft",
  paymentStatus: "unpaid",
  fulfillmentStatus: "not_started",
  draftExpiresAt: new Date(),
  nationalityCode: "US",
  serviceId: "svc-1",
  catalogCurrency: "USD",
  isGuest: true,
  userId: null,
  guestEmail: "guest@example.com",
  resumeTokenHash: "hash",
  checkoutState: null,
  passportExtractionStatus: "not_started",
  passportExtractionRunId: 0,
  adminAttentionRequired: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function mockCreatePartyDraft(row: unknown, overrides: Record<string, unknown> = {}) {
  vi.mocked(createPartyDraft).mockResolvedValue({
    partyId: "party-1",
    primaryApplicationId: (row as { id: string }).id,
    memberIds: [(row as { id: string }).id],
    primaryRow: row,
    ttlHours: 48,
    ...overrides,
  } as never);
}

describe("POST /api/applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(actor.withSystemDbActor).mockImplementation(async (fn) => fn({} as never));
  });

  it("guest create returns 201, Set-Cookie, no resume token in JSON", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    mockCreatePartyDraft(guestRow);

    const res = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nationalityCode: "US",
          serviceId: "svc-1",
          guestEmail: "guest@example.com",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.application.id).toBe("app-1");
    expect(body.data.application.catalogCurrency).toBe("USD");
    expect(body.data.partyId).toBe("party-1");
    expect(JSON.stringify(body.data)).not.toMatch(/resumeToken/i);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie?.toLowerCase()).toContain("httponly");
  });

  it("guest create allows missing email (set in applicant details)", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    mockCreatePartyDraft({ ...guestRow, guestEmail: null });

    const res = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationalityCode: "US", serviceId: "svc-1" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.application.id).toBe("app-1");
    expect(body.data.application.guestEmail).toBeNull();
  });

  it("rejects invalid catalog currency", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const res = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nationalityCode: "US",
          serviceId: "svc-1",
          guestEmail: "guest@example.com",
          catalogCurrency: "EUR",
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("signed-in create returns 201 without Set-Cookie", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never);
    mockCreatePartyDraft({
      ...guestRow,
      id: "app-2",
      isGuest: false,
      userId: "user-1",
      resumeTokenHash: null,
    });

    const res = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationalityCode: "US", serviceId: "svc-1" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("maps CreatePartyDraftValidationError to 400", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    vi.mocked(createPartyDraft).mockRejectedValue(
      new CreatePartyDraftValidationError("This checkout is for one traveller only."),
    );

    const res = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nationalityCode: "US",
          travelers: [
            { serviceId: "svc-1", kind: "adult" },
            { serviceId: "svc-2", kind: "adult" },
          ],
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
