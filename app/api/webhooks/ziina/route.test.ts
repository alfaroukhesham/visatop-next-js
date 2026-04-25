import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "ziina-w1" }),
}));

const withSystemMock = vi.fn();
vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: (...args: unknown[]) => withSystemMock(...args),
}));

// Force signature verification to pass (we're testing provider mismatch ordering).
vi.mock("@/lib/payments/ziina-webhook", async () => {
  const mod = await vi.importActual<typeof import("@/lib/payments/ziina-webhook")>(
    "@/lib/payments/ziina-webhook",
  );
  return {
    ...mod,
    verifyZiinaWebhookSignature: () => true,
  };
});

import { POST } from "./route";

function txMock(opts: { paymentProvider: string }) {
  const insert = vi.fn(() => ({ values: async () => {} }));
  const execute = vi.fn(async () => ({ rows: [{ ok: 1 }] }));
  const update = vi.fn(() => ({
    set: () => ({
      where: () => ({
        returning: async () => [{ key: "last_webhook_received_at_ziina" }],
      }),
    }),
  }));
  return {
    __calls: { insert, execute, update },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            // payment row returned by resolvePaymentRowForWebhook via select().from(payment) ...
            {
              id: "pay_1",
              provider: opts.paymentProvider,
              applicationId: "app_1",
              amount: 1000,
              status: "checkout_created",
              providerCheckoutId: "intent_1",
              providerTransactionId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        }),
      }),
    }),
    execute,
    insert,
    update,
  };
}

describe("POST /api/webhooks/ziina (R8 ordering)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ZIINA_WEBHOOK_SECRET", "secret");
  });

  it("does not insert payment_event when payment.provider mismatches route provider", async () => {
    const tx = txMock({ paymentProvider: "paddle" });
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx as never));

    const body = JSON.stringify({
      event: "payment_intent.status.updated",
      data: { id: "intent_1", status: "completed", amount: 1000, currency_code: "USD", operation_id: "op_1" },
    });

    const res = await POST(
      new Request("http://localhost:3000/api/webhooks/ziina", {
        method: "POST",
        headers: { "x-hmac-signature": "deadbeef" },
        body,
      }),
    );

    expect(res.status).toBe(401);
    // Provider mismatch should short-circuit before schema guard + payment_event insert.
    expect(tx.__calls.execute).toHaveBeenCalledTimes(0);
    // Only the webhook-health update + audit insert are expected.
    expect(tx.__calls.update).toHaveBeenCalledTimes(1);
    expect(tx.__calls.insert).toHaveBeenCalledTimes(1);
  });
});

