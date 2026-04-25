import { describe, expect, it, vi } from "vitest";

vi.mock("./paddle-adapter", () => ({
  paddleAdapter: {
    parseWebhookEvent: vi.fn(),
  },
}));

import { paddleAdapter } from "./paddle-adapter";
import { parsePaddleWebhookBodyToNormalized } from "./paddle-webhook-normalize";

describe("parsePaddleWebhookBodyToNormalized", () => {
  it("maps transaction.completed into payment_completed and forwards currency + event id", () => {
    vi.mocked(paddleAdapter.parseWebhookEvent).mockReturnValue({
      type: "transaction.completed",
      transactionId: "txn_123",
      amountMinor: 1050,
      metadata: { applicationId: "app_1" },
    } as never);

    const body = JSON.stringify({
      event_id: "evt_1",
      event_type: "transaction.completed",
      data: {
        currency_code: "usd",
        id: "txn_123",
        custom_data: { applicationId: "app_1" },
      },
    });

    const out = parsePaddleWebhookBodyToNormalized(body);
    expect(out.provider).toBe("paddle");
    expect(out.kind).toBe("payment_completed");
    expect(out.providerPaymentId).toBe("txn_123");
    expect(out.amountMinor).toBe(1050);
    expect(out.currency).toBe("USD");
    expect(out.providerEventId).toBe("evt_1");
    expect(out.metadata.applicationId).toBe("app_1");
  });

  it("throws on unsupported event type", () => {
    vi.mocked(paddleAdapter.parseWebhookEvent).mockReturnValue({
      type: "transaction.updated",
      transactionId: "txn_123",
      amountMinor: 1050,
      metadata: {},
    } as never);

    const body = JSON.stringify({
      event_id: "evt_1",
      event_type: "transaction.updated",
      data: { currency_code: "USD", id: "txn_123" },
    });

    expect(() => parsePaddleWebhookBodyToNormalized(body)).toThrow(/Unsupported Paddle webhook event/);
  });
});

