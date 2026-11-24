import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "extras-test" }),
}));
vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));
vi.mock("@/lib/checkout-extras/checkout-extra-admin", () => ({
  listCheckoutExtras: vi.fn(),
  saveCheckoutExtra: vi.fn(),
  CheckoutExtraAdminError: class CheckoutExtraAdminError extends Error {
    code = "NOT_FOUND" as const;
  },
}));
vi.mock("@/lib/pricing/fx-usd-aed", () => ({
  peekResolvedFxRateFromTx: vi.fn(),
}));

import { adminAuth } from "@/lib/admin-auth";
import * as actorContext from "@/lib/db/actor-context";
import { listCheckoutExtras } from "@/lib/checkout-extras/checkout-extra-admin";
import { peekResolvedFxRateFromTx } from "@/lib/pricing/fx-usd-aed";
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({ tx: {} as never, permissions: ["catalog.read"] }),
  );
});

describe("GET /api/admin/catalog/extras", () => {
  it("returns 401 when there is no admin session", async () => {
    vi.mocked(adminAuth.api.getSession).mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when catalog.read is missing", async () => {
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({ tx: {} as never, permissions: [] }),
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns stored extras and the display rate used only as a fill helper", async () => {
    vi.mocked(listCheckoutExtras).mockResolvedValue([]);
    vi.mocked(peekResolvedFxRateFromTx).mockResolvedValue({ fxAedPerUsd: "3.6725", source: "setting" });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ extras: [], fxAedPerUsd: "3.6725" });
  });
});
