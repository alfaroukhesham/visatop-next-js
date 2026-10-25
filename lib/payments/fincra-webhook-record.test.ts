import { describe, expect, it, vi } from "vitest";
import { auditFincraUnpaidAttemptEvent, recordFincraWebhookEvent } from "./fincra-webhook-record";
import { parseFincraWebhookEnvelope } from "./fincra-webhook";

const env = (over: Partial<ReturnType<typeof parseFincraWebhookEnvelope>> = {}) => ({
  eventName: "charge.expired",
  providerEventId: "77",
  merchantReference: "pay_1-a1",
  providerReference: "fcr-p-9",
  status: "expired",
  paymentIdFromMetadata: null,
  ...over,
});

const makeTx = (insertReturns: unknown[]) => {
  const values = vi.fn();
  const set = vi.fn();
  const tx = {
    insert: () => ({
      values: (v: unknown) => {
        values(v);
        return { onConflictDoNothing: () => ({ returning: async () => insertReturns }), then: undefined };
      },
    }),
    update: () => ({ set: (v: unknown) => (set(v), { where: async () => [] }) }),
  };
  return { tx, values, set };
};

const payRow = { id: "pay_1", status: "checkout_created", providerOperationId: "pay_1-a2" };

describe("parseFincraWebhookEnvelope", () => {
  it("reads any event type, our merchantReference and Fincra reference", () => {
    const e = parseFincraWebhookEnvelope(
      JSON.stringify({ event: "charge.expired", data: { id: 5, reference: "fcr-p-1", merchantReference: "abc-a1", status: "EXPIRED", metadata: { paymentId: "abc" } } }),
    );
    expect(e).toEqual({
      eventName: "charge.expired",
      providerEventId: "5",
      merchantReference: "abc-a1",
      providerReference: "fcr-p-1",
      status: "expired",
      paymentIdFromMetadata: "abc",
    });
    expect(parseFincraWebhookEnvelope("not json")).toBeNull();
  });
});

describe("recordFincraWebhookEvent", () => {
  it("inserts a matched row with audit columns", async () => {
    const { tx, values } = makeTx([{ id: "e1" }]);
    const stored = await recordFincraWebhookEvent(tx as never, { envelope: env(), payloadHash: "h", payRow: payRow as never });
    expect(stored).toBe(true);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "pay_1", type: "charge.expired", matched: true, signatureValid: true, provider: "fincra", merchantReference: "pay_1-a1" }),
    );
  });
  it("inserts unmatched rows with null payment id", async () => {
    const { tx, values } = makeTx([{ id: "e1" }]);
    await recordFincraWebhookEvent(tx as never, { envelope: env(), payloadHash: "h", payRow: null });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ paymentId: null, matched: false }));
  });
  it("returns false on duplicate payload hash", async () => {
    const { tx, set } = makeTx([]);
    const stored = await recordFincraWebhookEvent(tx as never, { envelope: env(), payloadHash: "h", payRow: null });
    expect(stored).toBe(false);
    expect(set).toHaveBeenCalled();
  });
});

describe("auditFincraUnpaidAttemptEvent", () => {
  it("audits without updating payment, flags stale attempts", async () => {
    const { tx, values, set } = makeTx([]);
    const r = await auditFincraUnpaidAttemptEvent(tx as never, { envelope: env(), payRow: payRow as never });
    expect(r).toEqual({ isCurrentAttempt: false });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ action: "payment_fincra_attempt_expired" }));
    expect(set).not.toHaveBeenCalled();
  });
  it("ignores non-terminal events", async () => {
    const { tx } = makeTx([]);
    expect(await auditFincraUnpaidAttemptEvent(tx as never, { envelope: env({ eventName: "charge.successful" }), payRow: payRow as never })).toBeNull();
  });
});
