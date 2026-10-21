import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "refund-1" }),
}));

vi.mock("@/lib/admin-api/require-admin-db", () => ({
  runAdminDbJson: vi.fn(),
}));

vi.mock("@/lib/admin-api/write-admin-audit", () => ({
  writeAdminAudit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/payments/resolve-payment-provider", () => ({
  getFincraServerConfig: vi.fn(() => ({
    apiBaseUrl: "https://sandboxapi.fincra.com",
    secretKey: "sk",
    publicKey: "pk",
    businessId: "biz",
    webhookSecret: "whsec",
    feeBearer: "business",
  })),
  getZiinaServerConfig: vi.fn(),
}));

vi.mock("@/lib/payments/fincra-client", () => ({
  initiateFincraRefund: vi.fn(),
  FincraProviderError: class FincraProviderError extends Error {
    httpStatus = 422;
  },
}));

vi.mock("@/lib/payments/ziina-client", () => ({
  initiateZiinaRefund: vi.fn(),
  ZiinaProviderError: class ZiinaProviderError extends Error {},
}));

vi.mock("@/lib/payments/paddle-adapter", () => ({
  paddleAdapter: { initiateRefund: vi.fn() },
  PaddleProviderError: class PaddleProviderError extends Error {},
}));

import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { initiateFincraRefund, FincraProviderError } from "@/lib/payments/fincra-client";
import { POST } from "./route";

describe("POST /api/admin/applications/[id]/refund Fincra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const runWith = async (tx: unknown) => {
    vi.mocked(runAdminDbJson).mockImplementation(async (_rid, _perms, fn) =>
      fn({ tx, adminUserId: "admin-1" } as never),
    );
    return POST(new Request("http://localhost/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "customer_request" }),
    }), { params: Promise.resolve({ id: "app_1" }) });
  };

  it("initiates a Fincra refund and treats already-initiated as success", async () => {
    vi.mocked(initiateFincraRefund).mockResolvedValue({
      refundId: "already-initiated",
      status: "already_initiated",
      alreadyInitiated: true,
    });
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "app_1", paymentStatus: "paid" }],
            orderBy: () => ({
              limit: async () => [
                {
                  provider: "fincra",
                  providerCheckoutId: "fcr-p-abc",
                  providerTransactionId: null,
                },
              ],
            }),
          }),
        }),
      }),
      update: () => ({ set: () => ({ where: async () => [] }) }),
    };
    const res = await runWith(tx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.alreadyInitiated).toBe(true);
    expect(initiateFincraRefund).toHaveBeenCalledWith(
      expect.objectContaining({ transReference: "fcr-p-abc" }),
    );
  });

  it("asks ops to finish the refund in the dashboard when no Fincra reference exists", async () => {
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "app_1", paymentStatus: "paid" }],
            orderBy: () => ({
              limit: async () => [
                {
                  provider: "fincra",
                  providerCheckoutId: null,
                  providerTransactionId: null,
                },
              ],
            }),
          }),
        }),
      }),
      update: () => ({ set: () => ({ where: async () => [] }) }),
    };
    const res = await runWith(tx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.details.reason).toBe("fincra_refund_missing_reference");
    expect(json.error.message).toMatch(/Fincra dashboard/i);
    expect(initiateFincraRefund).not.toHaveBeenCalled();
  });

  it("surfaces a clear error when Fincra will not refund via API", async () => {
    vi.mocked(initiateFincraRefund).mockRejectedValue(
      new FincraProviderError("Refunds are only available for variance collections"),
    );
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "app_1", paymentStatus: "paid" }],
            orderBy: () => ({
              limit: async () => [
                {
                  provider: "fincra",
                  providerCheckoutId: "fcr-p-abc",
                  providerTransactionId: null,
                },
              ],
            }),
          }),
        }),
      }),
      update: () => ({ set: () => ({ where: async () => [] }) }),
    };
    const res = await runWith(tx);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("FINCRA_REFUND_UNAVAILABLE");
    expect(json.error.message).toMatch(/Fincra dashboard/i);
  });
});
