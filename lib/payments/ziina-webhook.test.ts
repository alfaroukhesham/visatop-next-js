import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseZiinaWebhookToNormalized, verifyZiinaWebhookSignature } from "./ziina-webhook";

describe("verifyZiinaWebhookSignature", () => {
  it("accepts a valid hex HMAC of raw body", () => {
    const secret = "test-secret";
    const body = '{"event":"payment_intent.status.updated","data":{"id":"pi_1","status":"completed","amount":100,"currency_code":"USD"}}';
    const sig = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifyZiinaWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyZiinaWebhookSignature(body, "deadbeef", secret)).toBe(false);
  });
});

describe("parseZiinaWebhookToNormalized", () => {
  it("maps completed to payment_completed", () => {
    const body = JSON.stringify({
      event: "payment_intent.status.updated",
      data: { id: "intent_1", status: "completed", amount: 1050, currency_code: "usd", operation_id: "op_1" },
    });
    const r = parseZiinaWebhookToNormalized(body);
    expect(r.kind).toBe("event");
    if (r.kind === "event") {
      expect(r.event.provider).toBe("ziina");
      expect(r.event.kind).toBe("payment_completed");
      expect(r.event.providerPaymentId).toBe("intent_1");
      expect(r.event.amountMinor).toBe(1050);
      expect(r.event.currency).toBe("USD");
      expect(r.event.metadata.operationId).toBe("op_1");
    }
  });

  it("ignores non-terminal statuses", () => {
    const body = JSON.stringify({
      event: "payment_intent.status.updated",
      data: { id: "intent_1", status: "pending", amount: 1, currency_code: "USD" },
    });
    expect(parseZiinaWebhookToNormalized(body).kind).toBe("ignored");
  });
});
