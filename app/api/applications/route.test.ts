import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "app-create-test" }),
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
  withSystemDbActor: vi.fn(),
}));

import { auth } from "@/lib/auth";
import * as actor from "@/lib/db/actor-context";
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

function mockTxReturning(rows: unknown[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ value: "48" }],
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: async () => rows,
      }),
    }),
  };
}

describe("POST /api/applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guest create returns 201, Set-Cookie, no resume token in JSON", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    vi.mocked(actor.withSystemDbActor).mockImplementation(async (fn) =>
      fn(mockTxReturning([guestRow]) as never),
    );

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
    expect(JSON.stringify(body.data)).not.toMatch(/resumeToken/i);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie?.toLowerCase()).toContain("httponly");
  });

  it("guest create rejects missing email", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const res = await POST(
      new Request("http://localhost/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationalityCode: "US", serviceId: "svc-1" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
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
    vi.mocked(actor.withClientDbActor).mockImplementation(async (_uid, fn) =>
      fn(
        mockTxReturning([
          { ...guestRow, id: "app-2", isGuest: false, userId: "user-1", resumeTokenHash: null },
        ]) as never,
      ),
    );

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
});
