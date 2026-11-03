import { describe, expect, it, vi } from "vitest";
import { recordZiinaWebhookEvent } from "./ziina-webhook-record";

const envelope = {
  eventName: "payment_intent.status.updated",
  intentId: "pi_1",
  status: "pending",
};

const makeTx = (insertReturns: unknown[]) => {
  const values = vi.fn();
  const set = vi.fn();
  const tx = {
    insert: () => ({
      values: (v: unknown) => {
        values(v);
        return { onConflictDoNothing: () => ({ returning: async () => insertReturns }) };
      },
    }),
    update: () => ({
      set: (v: unknown) => (set(v), { where: async () => undefined }),
    }),
  };
  return { tx, values, set };
};

describe("recordZiinaWebhookEvent", () => {
  it("stores signature-verified ignored statuses against the matching payment", async () => {
    const { tx, values } = makeTx([{ id: "e1" }]);
    const stored = await recordZiinaWebhookEvent(tx as never, {
      envelope,
      payloadHash: "h",
      payRow: { id: "pay_1" } as never,
    });
    expect(stored).toBe(true);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pay_1",
        type: "payment_intent.status.updated",
        status: "pending",
        provider: "ziina",
        signatureValid: true,
        matched: true,
      }),
    );
  });

  it("stores unmatched verified webhooks with a null payment id", async () => {
    const { tx, values } = makeTx([{ id: "e1" }]);
    await recordZiinaWebhookEvent(tx as never, { envelope, payloadHash: "h", payRow: null });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ paymentId: null, matched: false }));
  });
});
