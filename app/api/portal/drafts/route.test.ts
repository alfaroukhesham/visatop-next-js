import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "portal-drafts-test" }),
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

describe("GET /api/portal/drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(new Request("http://localhost/api/portal/drafts"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns items + nextCursor null when <= limit", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);

    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    vi.mocked(actor.withClientDbActor).mockImplementation(async (_uid, fn) =>
      fn(
        mockTxReturning([
          {
            id: "app-1",
            referenceNumber: null,
            serviceId: "svc-1",
            nationalityCode: "US",
            createdAt,
            draftExpiresAt: null,
          },
        ]) as never,
      ),
    );

    const res = await GET(new Request("http://localhost/api/portal/drafts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.nextCursor).toBeNull();
  });

  it("uses default limit 5 and returns nextCursor when more", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    const capture: { limit?: number } = {};

    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const rows = Array.from({ length: 6 }).map((_, i) => ({
      id: `app-${i + 1}`,
      referenceNumber: null,
      serviceId: "svc-1",
      nationalityCode: "US",
      createdAt: new Date(createdAt.getTime() - i * 1000),
      draftExpiresAt: null,
    }));

    vi.mocked(actor.withClientDbActor).mockImplementation(async (_uid, fn) =>
      fn(mockTxReturning(rows, capture) as never),
    );

    const res = await GET(new Request("http://localhost/api/portal/drafts"));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(capture.limit).toBe(6); // default limit 5, fetch limit+1
    expect(body.data.items).toHaveLength(5);
    expect(typeof body.data.nextCursor).toBe("string");
  });
});

