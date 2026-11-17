import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseFincraWebhookEnvelope,
  parseFincraWebhookToNormalized,
  verifyFincraWebhookSignature,
} from "./fincra-webhook";

const secret = "webhook-secret";

const sign = (body: string) => crypto.createHmac("sha512", secret).update(body, "utf8").digest("hex");

describe("verifyFincraWebhookSignature", () => {
  it("accepts HMAC-SHA512 of the raw body", () => {
    const body = '{"event":"charge.successful","data":{"id":1}}';
    expect(verifyFincraWebhookSignature(body, sign(body), secret)).toBe(true);
  });

  it("accepts HMAC of JSON.stringify(parsed) when that differs from the raw body", () => {
    const raw = '{ "event": "charge.successful", "data": { "id": 1 } }';
    const reserialized = JSON.stringify(JSON.parse(raw));
    expect(raw).not.toBe(reserialized);
    expect(verifyFincraWebhookSignature(raw, sign(reserialized), secret)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const body = '{"event":"charge.successful","data":{"id":1}}';
    expect(verifyFincraWebhookSignature(body, "deadbeef", secret)).toBe(false);
    expect(verifyFincraWebhookSignature(body, sign(body), "other")).toBe(false);
    expect(verifyFincraWebhookSignature(body, null, secret)).toBe(false);
  });
});

describe("parseFincraWebhookToNormalized", () => {
  it("does not assume NGN when currency is missing", () => {
    const body = JSON.stringify({
      event: "charge.successful",
      data: {
        id: 1,
        amount: 100,
        status: "success",
        reference: "fcr-p-x",
      },
    });
    const r = parseFincraWebhookToNormalized(body);
    expect(r.kind).toBe("event");
    if (r.kind === "event") expect(r.event.currency).toBe("");
  });

  it("maps charge.successful to payment_completed", () => {
    const body = JSON.stringify({
      event: "charge.successful",
      data: {
        id: 601227,
        amount: 185000,
        amountReceived: 185000,
        currency: "NGN",
        status: "success",
        reference: "fcr-p-abc",
        chargeReference: "fcr-bt-xyz",
        merchantReference: "pay_1",
        metadata: { applicationId: "app_1" },
      },
    });
    const r = parseFincraWebhookToNormalized(body);
    expect(r.kind).toBe("event");
    if (r.kind === "event") {
      expect(r.event.provider).toBe("fincra");
      expect(r.event.kind).toBe("payment_completed");
      expect(r.event.providerPaymentId).toBe("fcr-p-abc");
      expect(r.event.currency).toBe("NGN");
      expect(r.event.amountMinor).toBe(18500000);
      expect(r.event.metadata.operationId).toBe("pay_1");
      expect(r.event.metadata.applicationId).toBe("app_1");
      expect(r.merchantReference).toBe("pay_1");
    }
  });

  it("keeps paymentId from checkout metadata, including nested copies", () => {
    const body = JSON.stringify({
      event: "charge.successful",
      data: {
        id: 601227,
        amount: 185000,
        currency: "NGN",
        status: "success",
        reference: "fcr-p-abc",
        merchantReference: "pay_1-a2",
        metadata: {
          reference: "pay_1-a2",
          metadata: { applicationId: "app_1", paymentId: "pay_1" },
        },
      },
    });
    const r = parseFincraWebhookToNormalized(body);
    expect(r.kind).toBe("event");
    if (r.kind === "event") {
      expect(r.merchantReference).toBe("pay_1-a2");
      expect(r.event.metadata.paymentId).toBe("pay_1");
      expect(r.event.metadata.applicationId).toBe("app_1");
      expect(r.event.metadata.operationId).toBe("pay_1-a2");
    }
  });

  it("ignores unsupported events", () => {
    const body = JSON.stringify({ event: "payout.successful", data: { id: 1 } });
    expect(parseFincraWebhookToNormalized(body).kind).toBe("ignored");
  });

  it("ignores invalid JSON", () => {
    const r = parseFincraWebhookToNormalized("not-json");
    expect(r.kind).toBe("ignored");
    if (r.kind === "ignored") expect(r.reason).toBe("invalid_json");
  });

  it("reads our attempt ref from data.reference for portal charge.successful", () => {
    const body = JSON.stringify({
      event: "charge.successful",
      data: {
        id: 601227,
        amount: 185000,
        amountReceived: 185000,
        currency: "NGN",
        status: "success",
        reference: "etayplfayznwkmo4fgz2dmeh-a1",
        chargeReference: "fcr-p-portal",
        metadata: { paymentId: "etayplfayznwkmo4fgz2dmeh", applicationId: "app_1" },
      },
    });
    const r = parseFincraWebhookToNormalized(body);
    expect(r.kind).toBe("event");
    if (r.kind === "event") {
      expect(r.merchantReference).toBe("etayplfayznwkmo4fgz2dmeh-a1");
      expect(r.event.providerPaymentId).toBe("fcr-p-portal");
      expect(r.event.metadata.operationId).toBe("etayplfayznwkmo4fgz2dmeh-a1");
      expect(r.event.metadata.paymentId).toBe("etayplfayznwkmo4fgz2dmeh");
    }
    const env = parseFincraWebhookEnvelope(body);
    expect(env?.merchantReference).toBe("etayplfayznwkmo4fgz2dmeh-a1");
    expect(env?.providerReference).toBe("fcr-p-portal");
  });

  it("does not treat payment-link metadata.reference as our merchant ref", () => {
    const body = JSON.stringify({
      event: "charge.successful",
      data: {
        id: 1,
        amount: 100,
        status: "success",
        currency: "NGN",
        reference: "fcr-p-a7211ae64e",
        metadata: { reference: "abcdefghij1234567890a", title: "link" },
      },
    });
    const r = parseFincraWebhookToNormalized(body);
    expect(r.kind).toBe("event");
    if (r.kind === "event") {
      expect(r.merchantReference).toBeNull();
      expect(r.event.providerPaymentId).toBe("fcr-p-a7211ae64e");
      expect(r.event.metadata.operationId).toBeUndefined();
    }
  });
});

describe("parseFincraWebhookEnvelope portal refs", () => {
  it("reads charge.expired with attempt ref on data.reference", () => {
    const e = parseFincraWebhookEnvelope(
      JSON.stringify({
        event: "charge.expired",
        data: {
          id: 5,
          reference: "pay_1-a1",
          status: "expired",
          metadata: { paymentId: "pay_1" },
        },
      }),
    );
    expect(e?.merchantReference).toBe("pay_1-a1");
    expect(e?.providerReference).toBe("pay_1-a1");
    expect(e?.paymentIdFromMetadata).toBe("pay_1");
  });
});
