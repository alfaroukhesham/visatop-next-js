import { describe, expect, it } from "vitest";
import {
  abandonFincraCheckoutLock,
  FINCRA_OPEN_PAYMENT_STALE_MS,
  isFincraOpenPaymentStale,
  isFincraOpenPaymentUnprovisioned,
  shouldSelfHealFincraOpenPayment,
} from "./fincra-checkout-lock";

const createdAt = new Date("2026-10-21T12:00:00.000Z");

describe("Fincra checkout lock self-heal", () => {
  it("treats a missing provider_checkout_id as unprovisioned", () => {
    expect(isFincraOpenPaymentUnprovisioned(null)).toBe(true);
    expect(isFincraOpenPaymentUnprovisioned("")).toBe(true);
    expect(isFincraOpenPaymentUnprovisioned("  ")).toBe(true);
    expect(isFincraOpenPaymentUnprovisioned("fcr-p-abc")).toBe(false);
  });

  it("treats sessions older than the stale window as stale", () => {
    expect(isFincraOpenPaymentStale(createdAt, createdAt.getTime() + FINCRA_OPEN_PAYMENT_STALE_MS)).toBe(true);
    expect(isFincraOpenPaymentStale(createdAt, createdAt.getTime() + FINCRA_OPEN_PAYMENT_STALE_MS - 1)).toBe(false);
  });

  it("self-heals unprovisioned or stale Fincra checkout_created rows", () => {
    expect(
      shouldSelfHealFincraOpenPayment({
        id: "pay_1",
        provider: "fincra",
        status: "checkout_created",
        providerCheckoutId: null,
        createdAt,
      }),
    ).toBe(true);

    expect(
      shouldSelfHealFincraOpenPayment(
        {
          id: "pay_1",
          provider: "fincra",
          status: "checkout_created",
          providerCheckoutId: "fcr-p-abc",
          createdAt,
        },
        createdAt.getTime() + FINCRA_OPEN_PAYMENT_STALE_MS,
      ),
    ).toBe(true);
  });

  it("does not self-heal a fresh hosted Fincra session or other providers", () => {
    expect(
      shouldSelfHealFincraOpenPayment(
        {
          id: "pay_1",
          provider: "fincra",
          status: "checkout_created",
          providerCheckoutId: "fcr-p-abc",
          createdAt,
        },
        createdAt.getTime() + 60_000,
      ),
    ).toBe(false);

    expect(
      shouldSelfHealFincraOpenPayment({
        id: "pay_1",
        provider: "ziina",
        status: "checkout_created",
        providerCheckoutId: null,
        createdAt,
      }),
    ).toBe(false);
  });
});

describe("abandonFincraCheckoutLock", () => {
  it("resets checkout_state, marks the payment failed, and writes an audit row", async () => {
    const updates: Array<{ set: Record<string, unknown> }> = [];
    const inserts: Array<{ values: Record<string, unknown> }> = [];
    const tx = {
      update: () => ({
        set: (set: Record<string, unknown>) => {
          updates.push({ set });
          return { where: async () => undefined };
        },
      }),
      insert: () => ({
        values: async (values: Record<string, unknown>) => {
          inserts.push({ values });
        },
      }),
    };

    await abandonFincraCheckoutLock(tx as never, {
      memberIds: ["app_1", "app_2"],
      paymentId: "pay_1",
      reason: "provider_unavailable",
      requestId: "req_1",
    });

    expect(updates.some((u) => u.set.checkoutState === "none" && u.set.paymentStatus === "unpaid")).toBe(true);
    expect(updates.some((u) => u.set.status === "failed")).toBe(true);
    expect(inserts[0]?.values).toMatchObject({
      action: "payment_fincra_checkout_abandoned",
      entityId: "pay_1",
    });
    expect(String(inserts[0]?.values.afterJson)).toContain("provider_unavailable");
    expect(String(inserts[0]?.values.afterJson)).toContain("req_1");
    expect(String(inserts[0]?.values.afterJson)).not.toMatch(/sk_|secret/i);
  });
});
