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

  it("does not mark paid on amount mismatch and flags admin attention", async () => {
    const { tx, updates, inserts } = makeTx();
    const result = await processFincraVerifiedPaymentInTransaction(tx, {
      normalized: event,
      decision: {
        kind: "mismatch",
        reason: "amount_mismatch",
        amountReceivedMinor: BigInt(10000),
        expectedMinor: BigInt(18500000),
        expectedCurrency: "NGN",
        reportedCurrency: "NGN",
        feeMinor: null,
      },
      payloadHash: "hash-under",
      eventType: "charge.successful",
      logLabel: "test",
      requestId: "req-mismatch",
    });
    expect(result.outcome).toBe("mismatch");
    expect(result.firstPaidApplicationId).toBeNull();
    expect(applyPaymentWebhookEvent).not.toHaveBeenCalled();
    expect(updates.some((u) => u.set.status === "mismatch")).toBe(true);
    expect(updates.some((u) => u.set.varianceType === "amount_mismatch")).toBe(true);
    expect(updates.some((u) => u.set.adminAttentionRequired === true && u.set.checkoutState === "none")).toBe(
      true,
    );
    expect(inserts.some((i) => i.values.action === "payment_fincra_mismatch_flagged")).toBe(true);
    expect(String(inserts.find((i) => i.values.action === "payment_fincra_mismatch_flagged")?.values.afterJson)).toContain(
      "req-mismatch",
    );
  });

  it("does not mark paid on currency mismatch", async () => {
    const { tx, updates } = makeTx();
    const result = await processFincraVerifiedPaymentInTransaction(tx, {
      normalized: event,
      decision: {
        kind: "mismatch",
        reason: "currency_mismatch",
        amountReceivedMinor: BigInt(18500000),
        expectedMinor: BigInt(18500000),
        expectedCurrency: "NGN",
        reportedCurrency: "USD",
        feeMinor: null,
      },
      payloadHash: "hash-ccy",
      eventType: "charge.successful",
      logLabel: "test",
      requestId: "req-ccy",
    });
    expect(result.outcome).toBe("mismatch");
    expect(applyPaymentWebhookEvent).not.toHaveBeenCalled();
    expect(updates.some((u) => u.set.varianceType === "currency_mismatch")).toBe(true);
  });

  it("does not mark paid when no payment row maps to the Fincra reference", async () => {
    vi.mocked(resolvePaymentRowForWebhook).mockResolvedValue(undefined);
    const { tx } = makeTx();
    const result = await processFincraVerifiedPaymentInTransaction(tx, {
      normalized: event,
      decision: {
        kind: "paid",
        amountReceivedMinor: BigInt(18500000),
        varianceType: "exact",
        feeMinor: null,
      },
      payloadHash: "hash-missing-row",
      eventType: "charge.successful",
      logLabel: "test",
      requestId: "req-missing",
    });
    expect(result.outcome).toBe("unknown_reference");
    expect(applyPaymentWebhookEvent).not.toHaveBeenCalled();
  });

  it("does not mark paid for an unknown reference", async () => {
    const { tx } = makeTx();
    const result = await processFincraVerifiedPaymentInTransaction(tx, {
      normalized: event,
      decision: { kind: "unknown_reference" },
      payloadHash: "hash-unknown",
      eventType: "charge.successful",
      logLabel: "test",
      requestId: "req-unknown",
    });
    expect(result.outcome).toBe("unknown_reference");
    expect(result.paymentId).toBeNull();
    expect(applyPaymentWebhookEvent).not.toHaveBeenCalled();
    expect(resolvePaymentRowForWebhook).not.toHaveBeenCalled();
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
