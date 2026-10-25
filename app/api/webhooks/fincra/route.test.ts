import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "fincra-w1" }),
}));

const withSystemMock = vi.fn();
vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: (...args: unknown[]) => withSystemMock(...args),
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
}));

const verifyMock = vi.fn();
vi.mock("@/lib/payments/fincra-client", () => ({
  verifyFincraCheckoutByMerchantReference: (...args: unknown[]) => verifyMock(...args),
  FincraProviderError: class FincraProviderError extends Error {
    httpStatus = 502;
  },
}));

const processMock = vi.fn();
vi.mock("@/lib/payments/process-fincra-payment", () => ({
  processFincraVerifiedPaymentInTransaction: (...args: unknown[]) => processMock(...args),
}));

const sideEffectsMock = vi.fn();
vi.mock("@/lib/payments/fincra-payment-side-effects", () => ({
  scheduleFincraPaidSideEffects: (...args: unknown[]) => sideEffectsMock(...args),
}));

const recordMock = vi.fn();
const auditMock = vi.fn();
vi.mock("@/lib/payments/fincra-webhook-record", () => ({
  recordFincraWebhookEvent: (...args: unknown[]) => recordMock(...args),
  auditFincraUnpaidAttemptEvent: (...args: unknown[]) => auditMock(...args),
}));

import { POST } from "./route";

const secret = "whsec";
const body = JSON.stringify({
  event: "charge.successful",
  data: {
    id: 1,
    amount: 185000,
    amountReceived: 185000,
    currency: "NGN",
    status: "success",
    reference: "fcr-p-1",
    merchantReference: "pay_1",
  },
});

const sign = (raw: string) => crypto.createHmac("sha512", secret).update(raw, "utf8").digest("hex");

const txMock = () => ({
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => [
          {
            id: "pay_1",
            provider: "fincra",
            applicationId: "app_1",
            amount: BigInt(18_500_000),
            currency: "NGN",
            status: "checkout_created",
          },
        ],
      }),
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => ({
        returning: async () => [{ key: "last_webhook_received_at_fincra" }],
      }),
    }),
  }),
});

describe("POST /api/webhooks/fincra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock()));
    verifyMock.mockResolvedValue({
      id: "1",
      status: "success",
      currency: "NGN",
      amountMinor: BigInt(18_500_000),
      amountReceivedMinor: BigInt(18_500_000),
      amountExpectedMinor: BigInt(18_500_000),
      varianceType: null,
      message: null,
      merchantReference: "pay_1",
      reference: "fcr-p-1",
      feeMinor: BigInt(301),
      raw: {},
    });
    processMock.mockResolvedValue({
      outcome: "applied",
      firstPaidApplicationId: "app_1",
      paymentId: "pay_1",
    });
    recordMock.mockResolvedValue(true);
    auditMock.mockResolvedValue({ isCurrentAttempt: true });
  });

  it("rejects an invalid signature without verifying with Fincra", async () => {
    const res = await POST(
      new Request("http://localhost/api/webhooks/fincra", {
        method: "POST",
        headers: { signature: "00".repeat(64) },
        body,
      }),
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("WEBHOOK_SIGNATURE_INVALID");
    expect(verifyMock).not.toHaveBeenCalled();
    expect(processMock).not.toHaveBeenCalled();
  });

  it("accepts a valid signature and ignores unsupported events", async () => {
    const ignored = JSON.stringify({ event: "payout.successful", data: { id: 1 } });
    const res = await POST(
      new Request("http://localhost/api/webhooks/fincra", {
        method: "POST",
        headers: { signature: sign(ignored) },
        body: ignored,
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.ignored).toMatch(/unsupported_event/);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("resolves an attempt reference and verifies with that merchant reference", async () => {
    const attemptBody = JSON.stringify({
      event: "charge.successful",
      data: {
        id: 1,
        amount: 185000,
        amountReceived: 185000,
        currency: "NGN",
        status: "success",
        reference: "fcr-p-1",
        merchantReference: "pay_1-a2",
        metadata: { paymentId: "pay_1", applicationId: "app_1" },
      },
    });
    verifyMock.mockResolvedValue({
      id: "1",
      status: "success",
      currency: "NGN",
      amountMinor: BigInt(18_500_000),
      amountReceivedMinor: BigInt(18_500_000),
      amountExpectedMinor: BigInt(18_500_000),
      varianceType: null,
      message: null,
      merchantReference: "pay_1-a2",
      reference: "fcr-p-1",
      feeMinor: BigInt(301),
      raw: {},
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/fincra", {
        method: "POST",
        headers: { signature: sign(attemptBody) },
        body: attemptBody,
      }),
    );
    expect(res.status).toBe(200);
    expect(verifyMock).toHaveBeenCalledWith(expect.objectContaining({ merchantReference: "pay_1-a2" }));
    expect(processMock).toHaveBeenCalledTimes(1);
  });

  it("verifies with Fincra then applies a successful charge", async () => {
    const res = await POST(
      new Request("http://localhost/api/webhooks/fincra", {
        method: "POST",
        headers: { signature: sign(body) },
        body,
      }),
    );
    expect(res.status).toBe(200);
    expect(verifyMock).toHaveBeenCalledWith(expect.objectContaining({ merchantReference: "pay_1" }));
    expect(processMock).toHaveBeenCalledTimes(1);
    expect(sideEffectsMock).toHaveBeenCalledWith("app_1", "fincra-w1");
  });

  it("does not re-apply when the payload hash is a duplicate", async () => {
    processMock.mockResolvedValue({
      outcome: "duplicate",
      firstPaidApplicationId: null,
      paymentId: "pay_1",
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/fincra", {
        method: "POST",
        headers: { signature: sign(body) },
        body,
      }),
    );
    expect(res.status).toBe(200);
    expect(sideEffectsMock).not.toHaveBeenCalled();
  });

  it("does not mark paid or send emails for amount mismatches", async () => {
    processMock.mockResolvedValue({
      outcome: "mismatch",
      firstPaidApplicationId: null,
      paymentId: "pay_1",
    });
    verifyMock.mockResolvedValue({
      id: "1",
      status: "success",
      currency: "NGN",
      amountMinor: BigInt(7300),
      amountReceivedMinor: BigInt(7300),
      amountExpectedMinor: BigInt(18_500_000),
      varianceType: "underpayment",
      message: "INCORRECT_AMOUNT",
      merchantReference: "pay_1",
      reference: "fcr-p-1",
      feeMinor: null,
      raw: {},
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/fincra", {
        method: "POST",
        headers: { signature: sign(body) },
        body,
      }),
    );
    expect(res.status).toBe(200);
    const decision = processMock.mock.calls[0]![1].decision;
    expect(decision.kind).toBe("mismatch");
    expect(decision.reason).toBe("amount_mismatch");
    expect(sideEffectsMock).not.toHaveBeenCalled();
  });

  it("does not mark paid on currency mismatch", async () => {
    processMock.mockResolvedValue({
      outcome: "mismatch",
      firstPaidApplicationId: null,
      paymentId: "pay_1",
    });
    verifyMock.mockResolvedValue({
      id: "1",
      status: "success",
      currency: "USD",
      amountMinor: BigInt(18_500_000),
      amountReceivedMinor: BigInt(18_500_000),
      amountExpectedMinor: BigInt(18_500_000),
      varianceType: null,
      message: null,
      merchantReference: "pay_1",
      reference: "fcr-p-1",
      feeMinor: null,
      raw: {},
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/fincra", {
        method: "POST",
        headers: { signature: sign(body) },
        body,
      }),
    );
    expect(res.status).toBe(200);
    const decision = processMock.mock.calls[0]![1].decision;
    expect(decision.kind).toBe("mismatch");
    expect(decision.reason).toBe("currency_mismatch");
    expect(sideEffectsMock).not.toHaveBeenCalled();
  });

  it("does not verify or mark paid for an unknown merchant reference", async () => {
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [],
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [{ key: "last_webhook_received_at_fincra" }],
            }),
          }),
        }),
      }),
    );
    const res = await POST(
      new Request("http://localhost/api/webhooks/fincra", {
        method: "POST",
        headers: { signature: sign(body) },
        body,
      }),
    );
    expect(res.status).toBe(200);
    expect(verifyMock).not.toHaveBeenCalled();
    expect(processMock).not.toHaveBeenCalled();
    expect(sideEffectsMock).not.toHaveBeenCalled();
  });

  const emptyTx = () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    update: () => ({
      set: () => ({ where: () => ({ returning: async () => [{ key: "last_webhook_received_at_fincra" }] }) }),
    }),
  });

  const post = (raw: string, signature = sign(raw)) =>
    POST(
      new Request("http://localhost/api/webhooks/fincra", {
        method: "POST",
        headers: { signature },
        body: raw,
      }),
    );

  const unpaidBody = (event: string, merchantReference: string) =>
    JSON.stringify({
      event,
      data: { id: 77, reference: "fcr-p-9", merchantReference, status: event.split(".")[1], amount: 332450, currency: "NGN" },
    });

  it.each(["charge.expired", "charge.failed"])("persists %s for an -aN ref and audits without verifying/marking", async (event) => {
    const res = await post(unpaidBody(event, "pay_1-a1"));
    expect(res.status).toBe(200);
    expect(recordMock).toHaveBeenCalledTimes(1);
    const arg = recordMock.mock.calls[0]![1];
    expect(arg.envelope.eventName).toBe(event);
    expect(arg.envelope.merchantReference).toBe("pay_1-a1");
    expect(arg.payRow.id).toBe("pay_1");
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).not.toHaveBeenCalled();
    expect(processMock).not.toHaveBeenCalled();
    expect(sideEffectsMock).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.data.matched).toBe(true);
  });

  it("stores an unknown (e.g. staging) reference as unmatched and returns 200", async () => {
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(emptyTx()));
    const res = await post(unpaidBody("charge.expired", "staging_pay-a1"));
    expect(res.status).toBe(200);
    expect(recordMock.mock.calls[0]![1].payRow).toBeNull();
    expect(auditMock).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.data.matched).toBe(false);
  });

  it("treats a duplicate delivery as a no-op", async () => {
    recordMock.mockResolvedValue(false);
    const res = await post(unpaidBody("charge.expired", "pay_1-a1"));
    expect(res.status).toBe(200);
    expect(auditMock).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.data.duplicate).toBe(true);
  });

  it("does not store anything on a bad signature", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(unpaidBody("charge.expired", "pay_1-a1"), "ab".repeat(64));
    expect(res.status).toBe(401);
    expect(recordMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[webhooks/fincra] Invalid webhook signature", expect.anything());
    warn.mockRestore();
  });

  it("also persists charge.successful events alongside processing", async () => {
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(processMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock.mock.calls[0]![1].payRow.id).toBe("pay_1");
  });

  it("stores an unmatched charge.successful without verifying", async () => {
    withSystemMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(emptyTx()));
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(recordMock.mock.calls[0]![1].payRow).toBeNull();
    expect(verifyMock).not.toHaveBeenCalled();
  });
});
