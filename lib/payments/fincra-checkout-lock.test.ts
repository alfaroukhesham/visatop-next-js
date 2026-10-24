import { describe, expect, it } from "vitest";
import {
  abandonFincraCheckoutLock,
  canRotateFincraInlineAttempt,
  classifyFincraLockedCheckoutRetry,
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

  it("does not treat a missing pay code as failed for live inline checkouts", () => {
    expect(
      shouldSelfHealFincraOpenPayment(
        {
          id: "pay_1",
          provider: "fincra",
          status: "checkout_created",
          providerCheckoutId: null,
          createdAt,
        },
        createdAt.getTime() + 60_000,
        { treatMissingPayCodeAsFailed: false },
      ),
    ).toBe(false);
  });
});

const pendingMembers = [{ checkoutState: "pending" as const, paymentStatus: "checkout_created" }];
const openInline = {
  id: "pay_1",
  provider: "fincra",
  status: "checkout_created",
  providerCheckoutId: null as string | null,
  createdAt,
  amount: BigInt(1_000_000),
  currency: "NGN",
};

describe("canRotateFincraInlineAttempt", () => {
  it("allows a retry of the same pending unpaid inline row at the locked amount", () => {
    expect(
      canRotateFincraInlineAttempt({
        fincraMode: "inline",
        payRow: openInline,
        members: pendingMembers,
        expectedAmount: openInline.amount,
        expectedCurrency: "NGN",
      }),
    ).toBe(true);
  });

  it("refuses hosted retries, paid rows, amount changes, and unlocked members", () => {
    expect(
      canRotateFincraInlineAttempt({
        fincraMode: "hosted",
        payRow: openInline,
        members: pendingMembers,
        expectedAmount: openInline.amount,
        expectedCurrency: "NGN",
      }),
    ).toBe(false);

    expect(
      canRotateFincraInlineAttempt({
        fincraMode: "inline",
        payRow: { ...openInline, status: "paid" },
        members: pendingMembers,
        expectedAmount: openInline.amount,
        expectedCurrency: "NGN",
      }),
    ).toBe(false);

    expect(
      canRotateFincraInlineAttempt({
        fincraMode: "inline",
        payRow: openInline,
        members: pendingMembers,
        expectedAmount: BigInt(2_000_000),
        expectedCurrency: "NGN",
      }),
    ).toBe(false);

    expect(
      canRotateFincraInlineAttempt({
        fincraMode: "inline",
        payRow: openInline,
        members: pendingMembers,
        expectedAmount: openInline.amount,
        expectedCurrency: "USD",
      }),
    ).toBe(false);

    expect(
      canRotateFincraInlineAttempt({
        fincraMode: "inline",
        payRow: openInline,
        members: [{ checkoutState: "pending", paymentStatus: "paid" }],
        expectedAmount: openInline.amount,
        expectedCurrency: "NGN",
      }),
    ).toBe(false);

    expect(
      canRotateFincraInlineAttempt({
        fincraMode: "inline",
        payRow: openInline,
        members: [{ checkoutState: "none", paymentStatus: "checkout_created" }],
        expectedAmount: openInline.amount,
        expectedCurrency: "NGN",
      }),
    ).toBe(false);
  });
});

describe("classifyFincraLockedCheckoutRetry", () => {
  it("rotates a still-pending inline checkout instead of creating a new payment row", () => {
    expect(
      classifyFincraLockedCheckoutRetry({
        fincraMode: "inline",
        payRow: openInline,
        members: pendingMembers,
      }),
    ).toBe("rotate");
  });

  it("returns 409 for inline when the lock cannot be rotated", () => {
    expect(
      classifyFincraLockedCheckoutRetry({
        fincraMode: "inline",
        payRow: { ...openInline, status: "paid" },
        members: pendingMembers,
      }),
    ).toBe("conflict");

    expect(
      classifyFincraLockedCheckoutRetry({
        fincraMode: "inline",
        payRow: openInline,
        members: [{ checkoutState: "none", paymentStatus: "unpaid" }],
      }),
    ).toBe("conflict");
  });

  it("keeps hosted unprovisioned self-heal and otherwise 409s", () => {
    expect(
      classifyFincraLockedCheckoutRetry({
        fincraMode: "hosted",
        payRow: openInline,
        members: pendingMembers,
        nowMs: createdAt.getTime() + 60_000,
      }),
    ).toBe("self_heal");

    expect(
      classifyFincraLockedCheckoutRetry({
        fincraMode: "hosted",
        payRow: {
          ...openInline,
          providerCheckoutId: "fcr-p-abc",
        },
        members: pendingMembers,
        nowMs: createdAt.getTime() + 60_000,
      }),
    ).toBe("conflict");
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
