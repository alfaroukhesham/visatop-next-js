import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "extra-write-test" }),
}));
vi.mock("@/lib/admin-auth", () => ({
  adminAuth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/db/actor-context", () => ({
  withAdminDbActor: vi.fn(),
}));
vi.mock("@/lib/admin-api/write-admin-audit", () => ({
  writeAdminAudit: vi.fn(),
}));
vi.mock("@/lib/checkout-extras/checkout-extra-admin", () => ({
  saveCheckoutExtra: vi.fn(),
  CheckoutExtraAdminError: class CheckoutExtraAdminError extends Error {
    readonly code = "NOT_FOUND";
    constructor(message: string) {
      super(message);
      this.name = "CheckoutExtraAdminError";
    }
  },
}));

import { adminAuth } from "@/lib/admin-auth";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import * as actorContext from "@/lib/db/actor-context";
import { CheckoutExtraAdminError, saveCheckoutExtra } from "@/lib/checkout-extras/checkout-extra-admin";
import { PUT } from "./route";

const body = {
  enabled: true,
  baseCurrency: "AED",
  baseAmountMajor: "79",
  labels: { en: "Travel insurance" },
  descriptions: {},
  promise: null,
  termsUrl: null,
  prices: [{ currency: "AED", amountMajor: "79" }],
};

const jsonRequest = (payload: unknown) =>
  new Request("http://localhost/api/admin/catalog/extras/travel_insurance", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

const savedExtra = {
  key: "travel_insurance" as const,
  enabled: true,
  chargeBasis: "per_traveller" as const,
  baseCurrency: "AED",
  baseAmountMinor: 7900,
  baseAmountMajor: "79.00",
  labels: { en: "Travel insurance" },
  descriptions: {},
  promise: null,
  termsUrl: null,
  sortOrder: 0,
  prices: [{ currency: "AED", amountMinor: 7900, amountMajor: "79.00" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminAuth.api.getSession).mockResolvedValue({ user: { id: "admin-1" } } as never);
  vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
    fn({
      tx: { id: "tx" } as never,
      permissions: ["catalog.read", "catalog.write", "audit.write"],
    }),
  );
});

describe("PUT /api/admin/catalog/extras/[key]", () => {
  it("returns 403 when catalog.write is missing", async () => {
    vi.mocked(actorContext.withAdminDbActor).mockImplementation(async (_id, fn) =>
      fn({ tx: {} as never, permissions: ["catalog.read"] }),
    );
    const res = await PUT(jsonRequest(body), { params: Promise.resolve({ key: "travel_insurance" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown extra key", async () => {
    const res = await PUT(jsonRequest(body), { params: Promise.resolve({ key: "priority" }) });
    expect(res.status).toBe(404);
    expect(saveCheckoutExtra).not.toHaveBeenCalled();
  });

  it("rejects an empty English label before writing", async () => {
    const res = await PUT(jsonRequest({ ...body, labels: { en: "" } }), {
      params: Promise.resolve({ key: "travel_insurance" }),
    });
    expect(res.status).toBe(400);
    expect(saveCheckoutExtra).not.toHaveBeenCalled();
  });

  it("writes the extra and an audit row", async () => {
    vi.mocked(saveCheckoutExtra).mockResolvedValue({ before: savedExtra, after: savedExtra });
    const res = await PUT(jsonRequest(body), { params: Promise.resolve({ key: "travel_insurance" }) });
    expect(res.status).toBe(200);
    expect(saveCheckoutExtra).toHaveBeenCalledWith(
      expect.anything(),
      "travel_insurance",
      expect.objectContaining({ enabled: true, baseAmountMinor: 7900 }),
    );
    expect(writeAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "catalog.checkout_extra.update",
        entityType: "checkout_extra",
        entityId: "travel_insurance",
      }),
    );
  });

  it("returns 404 when the seeded row is missing", async () => {
    vi.mocked(saveCheckoutExtra).mockRejectedValue(
      new CheckoutExtraAdminError("Checkout extra was not found.", "NOT_FOUND"),
    );
    const res = await PUT(jsonRequest(body), { params: Promise.resolve({ key: "travel_insurance" }) });
    expect(res.status).toBe(404);
  });
});
