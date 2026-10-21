import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payments/apply-payment-webhook-event", () => ({
  applyPaymentWebhookEvent: vi.fn(async () => ({ didFirstPaidTransition: true })),
  resolvePaymentRowForWebhook: vi.fn(),
}));

vi.mock("@/lib/payments/payment-webhook-db-guard", () => ({
  requirePaymentEventPayloadHashDedupeIndex: vi.fn(async () => undefined),
}));

import {
  applyPaymentWebhookEvent,
  resolvePaymentRowForWebhook,
} from "@/lib/payments/apply-payment-webhook-event";
import { processFincraVerifiedPaymentInTransaction } from "./process-fincra-payment";
import type { NormalizedPaymentWebhookEvent } from "./normalized-webhook";

const event: NormalizedPaymentWebhookEvent = {
  provider: "fincra",
  kind: "payment_completed",
  providerPaymentId: "fcr-p-abc",
  amountMinor: 18500000,
  currency: "NGN",
  metadata: { applicationId: "app_1", operationId: "pay_1" },
  rawEventType: "charge.successful",
  providerEventId: "601227",
};

const payRow = {
  id: "pay_1",
  provider: "fincra",
  applicationId: "app_1",
  amount: BigInt(18500000),
  currency: "NGN",
  status: "checkout_created",
  providerCheckoutId: "fcr-p-abc",
  providerOperationId: "pay_1",
  providerTransactionId: null,
};

const appRow = {
  id: "app_1",
  applicationStatus: "ready_for_payment",
  paymentStatus: "checkout_created",
  adminAttentionRequired: false,
};

const makeTx = (opts?: { duplicateEvent?: boolean }) => {
  const updates: Array<{ set: Record<string, unknown> }> = [];
  const inserts: Array<{ values: Record<string, unknown> }> = [];
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [appRow],
        }),
      }),
    }),
    update: () => ({
      set: (set: Record<string, unknown>) => ({
        where: () => {
          updates.push({ set });
          return {
            returning: async () => [{ id: "x" }],
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve([])),
          };
        },
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        inserts.push({ values });
        return {
          onConflictDoNothing: () => ({
            returning: async () => (opts?.duplicateEvent ? [] : [{ id: "evt_1" }]),
          }),
        };
      },
    }),
  };
  return { tx: tx as never, updates, inserts };
};

describe("processFincraVerifiedPaymentInTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolvePaymentRowForWebhook).mockResolvedValue(payRow as never);
  });

  it("does not mark paid on underpayment and flags admin attention", async () => {
    const { tx, updates, inserts } = makeTx();
    const result = await processFincraVerifiedPaymentInTransaction(tx, {
      normalized: event,
      decision: {
        kind: "underpaid",
        amountReceivedMinor: BigInt(10000),
        varianceType: "underpayment",
        feeMinor: null,
      },
      payloadHash: "hash-under",
      eventType: "charge.successful",
      logLabel: "test",
    });
    expect(result.outcome).toBe("underpaid");
    expect(result.firstPaidApplicationId).toBeNull();
    expect(applyPaymentWebhookEvent).not.toHaveBeenCalled();
    expect(updates.some((u) => u.set.status === "underpaid")).toBe(true);
    expect(updates.some((u) => u.set.adminAttentionRequired === true)).toBe(true);
    expect(inserts.length).toBeGreaterThan(0);
  });

  it("skips apply when the payload hash already exists", async () => {
    const { tx } = makeTx({ duplicateEvent: true });
    const result = await processFincraVerifiedPaymentInTransaction(tx, {
      normalized: event,
      decision: {
        kind: "paid",
        amountReceivedMinor: BigInt(18500000),
        varianceType: "exact",
        feeMinor: BigInt(301),
      },
      payloadHash: "hash-dup",
      eventType: "charge.successful",
      logLabel: "test",
    });
    expect(result.outcome).toBe("duplicate");
    expect(applyPaymentWebhookEvent).not.toHaveBeenCalled();
  });

  it("applies paid transitions for exact amounts", async () => {
    const { tx } = makeTx();
    const result = await processFincraVerifiedPaymentInTransaction(tx, {
      normalized: event,
      decision: {
        kind: "paid",
        amountReceivedMinor: BigInt(18500000),
        varianceType: "exact",
        feeMinor: BigInt(301),
      },
      payloadHash: "hash-ok",
      eventType: "charge.successful",
      logLabel: "test",
      verifiedIds: { payCode: "fcr-p-abc", fincraId: "601227" },
    });
    expect(result.outcome).toBe("applied");
    expect(result.firstPaidApplicationId).toBe("app_1");
    expect(applyPaymentWebhookEvent).toHaveBeenCalledTimes(1);
  });

  it("flags overpayment but still applies paid with the locked quote amount", async () => {
    const { tx, updates } = makeTx();
    const result = await processFincraVerifiedPaymentInTransaction(tx, {
      normalized: event,
      decision: {
        kind: "paid",
        amountReceivedMinor: BigInt(18_600_000),
        varianceType: "overpayment",
        feeMinor: BigInt(301),
      },
      payloadHash: "hash-over",
      eventType: "charge.successful",
      logLabel: "test",
    });
    expect(result.outcome).toBe("applied");
    expect(applyPaymentWebhookEvent).toHaveBeenCalledTimes(1);
    const paidArg = vi.mocked(applyPaymentWebhookEvent).mock.calls[0]![1];
    expect(paidArg.amountMinor).toBe(Number(payRow.amount));
    expect(updates.some((u) => u.set.adminAttentionRequired === true)).toBe(true);
    expect(updates.some((u) => u.set.varianceType === "overpayment")).toBe(true);
  });

  it("rejects provider mismatch without applying", async () => {
    vi.mocked(resolvePaymentRowForWebhook).mockResolvedValue({ ...payRow, provider: "ziina" } as never);
    const { tx } = makeTx();
    const result = await processFincraVerifiedPaymentInTransaction(tx, {
      normalized: event,
      decision: {
        kind: "paid",
        amountReceivedMinor: BigInt(18500000),
        varianceType: "exact",
        feeMinor: null,
      },
      payloadHash: "hash-mm",
      eventType: "charge.successful",
      logLabel: "test",
    });
    expect(result.outcome).toBe("rejected_provider_mismatch");
    expect(applyPaymentWebhookEvent).not.toHaveBeenCalled();
  });
});
