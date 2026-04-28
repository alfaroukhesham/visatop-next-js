import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "portal-applications-test" }),
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

import { auth } from "@/lib/auth";
import * as actor from "@/lib/db/actor-context";
import { GET } from "./route";

function mockTxReturning(rows: unknown[], capture?: { limit?: number }) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async (n: number) => {
              if (capture) capture.limit = n;
              return rows;
            },
          }),
        }),
      }),
    }),
  };
}

describe("GET /api/portal/applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost/api/portal/applications"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns items + nextCursor with default limit 5", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    const capture: { limit?: number } = {};

    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const rows = Array.from({ length: 6 }).map((_, i) => ({
      id: `app-${i + 1}`,
      referenceNumber: null,
      createdAt: new Date(createdAt.getTime() - i * 1000),
      applicationStatus: "draft",
      paymentStatus: "unpaid",
      fulfillmentStatus: "not_started",
      adminAttentionRequired: false,
    }));

    vi.mocked(actor.withClientDbActor).mockImplementation(async (_uid, fn) =>
      fn(mockTxReturning(rows, capture) as never),
    );

    const res = await GET(new Request("http://localhost/api/portal/applications"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(capture.limit).toBe(6);
    expect(body.data.items).toHaveLength(5);
    expect(body.data.items[0].clientTracking).toBeTruthy();
    expect(typeof body.data.nextCursor).toBe("string");
  });
});

