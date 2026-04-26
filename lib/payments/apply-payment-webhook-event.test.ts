import { describe, expect, it, vi } from "vitest";
import { applyPaymentWebhookEvent } from "./apply-payment-webhook-event";

vi.mock("@/lib/applications/retain-required-documents", () => ({
  retainRequiredDocuments: vi.fn(),
}));

import { retainRequiredDocuments } from "@/lib/applications/retain-required-documents";

function makeTx() {
  const updates: Array<{ table: string; set: unknown }> = [];
  const inserts: Array<{ table: string; values: unknown }> = [];

  const tx = {
    update: (table: { [k: string]: unknown }) => ({
      set: (set: unknown) => ({
        where: () => {
          const push = () =>
            updates.push({ table: String((table as { _: { name: string } })._?.name ?? "unknown"), set });

          // Support both:
          // - `await tx.update(...).set(...).where(...)`
          // - `await tx.update(...).set(...).where(...).returning(...)`
          return {
            returning: async () => {
              push();
              return [{ id: "x" }];
            },
            then: (resolve: (v: unknown) => unknown) => {
              push();
              return Promise.resolve(resolve([]));
            },
          };
        },
      }),
    }),
    insert: (table: { [k: string]: unknown }) => ({
      values: async (values: unknown) => {
        inserts.push({ table: String((table as { _: { name: string } })._?.name ?? "unknown"), values });
      },
    }),
  };

  return { tx: tx as never, updates, inserts };
}

describe("applyPaymentWebhookEvent", () => {
  it("flags admin attention and audits when paid arrives for cancelled application", async () => {
    vi.mocked(retainRequiredDocuments).mockResolvedValue({ ok: true } as never);
    const { tx, updates, inserts } = makeTx();

    await applyPaymentWebhookEvent(
      tx,
      {
        provider: "paddle",
        kind: "payment_completed",
        providerPaymentId: "txn_1",
        amountMinor: 1000,
        currency: "USD",
        metadata: { applicationId: "app_1" },
        rawEventType: "transaction.completed",
        providerEventId: "evt_1",
      },
      { id: "pay_1", provider: "paddle", applicationId: "app_1", amount: 1000 } as never,
      { id: "app_1", applicationStatus: "cancelled", paymentStatus: "unpaid", adminAttentionRequired: false } as never,
      "evt_1",
      {},
    );

    expect(updates.length).toBeGreaterThan(0);
    expect(inserts.length).toBeGreaterThan(0);
    // Should not attempt doc retention when cancelled
    expect(retainRequiredDocuments).not.toHaveBeenCalled();
  });

  it("retains docs only on first paid transition", async () => {
    vi.mocked(retainRequiredDocuments).mockResolvedValue({ ok: true } as never);
    const { tx } = makeTx();

    await applyPaymentWebhookEvent(
      tx,
      {
        provider: "paddle",
        kind: "payment_completed",
        providerPaymentId: "txn_1",
        amountMinor: 1000,
        currency: "USD",
        metadata: { applicationId: "app_1" },
        rawEventType: "transaction.paid",
        providerEventId: "evt_1",
      },
      { id: "pay_1", provider: "paddle", applicationId: "app_1", amount: 1000, providerTransactionId: null } as never,
      {
        id: "app_1",
        applicationStatus: "ready_for_payment",
        paymentStatus: "checkout_created",
        checkoutState: "pending",
        fulfillmentStatus: "none",
        adminAttentionRequired: false,
      } as never,
      "evt_1",
      {},
    );

    expect(retainRequiredDocuments).toHaveBeenCalledTimes(1);
  });
});

