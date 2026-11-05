import { describe, expect, it } from "vitest";
import { decideCheckoutRecoveryEmail, type TCheckoutRecoveryCandidate } from "./decide";

const delayMs = 60 * 60 * 1000;
const now = new Date("2026-11-05T12:00:00.000Z");
const minutesAgo = (m: number): Date => new Date(now.getTime() - m * 60_000);

const base = (overrides: Partial<TCheckoutRecoveryCandidate> = {}): TCheckoutRecoveryCandidate => ({
  hasEmail: true,
  applicationStatus: "ready_for_payment",
  paymentStatus: "checkout_created",
  checkoutAttempt: true,
  checkoutCreatedAt: minutesAgo(60),
  alreadySent: false,
  ...overrides,
});

describe("decideCheckoutRecoveryEmail", () => {
  it("skips when there is no recipient email", () => {
    expect(decideCheckoutRecoveryEmail(base({ hasEmail: false }), delayMs, now)).toEqual({
      action: "skip",
      reason: "no_email",
    });
  });

  it("skips paid, refunded, or refund pending", () => {
    expect(decideCheckoutRecoveryEmail(base({ paymentStatus: "paid" }), delayMs, now)).toEqual({
      action: "skip",
      reason: "settled_payment",
    });
    expect(decideCheckoutRecoveryEmail(base({ paymentStatus: "refunded" }), delayMs, now)).toEqual({
      action: "skip",
      reason: "settled_payment",
    });
    expect(
      decideCheckoutRecoveryEmail(base({ paymentStatus: "refund_pending" }), delayMs, now),
    ).toEqual({ action: "skip", reason: "settled_payment" });
  });

  it("skips cancelled applications", () => {
    expect(
      decideCheckoutRecoveryEmail(base({ applicationStatus: "cancelled" }), delayMs, now),
    ).toEqual({ action: "skip", reason: "cancelled" });
  });

  it("skips converted / terminal applications", () => {
    expect(
      decideCheckoutRecoveryEmail(base({ applicationStatus: "in_progress" }), delayMs, now),
    ).toEqual({ action: "skip", reason: "converted" });
    expect(
      decideCheckoutRecoveryEmail(base({ applicationStatus: "completed" }), delayMs, now),
    ).toEqual({ action: "skip", reason: "converted" });
  });

  it("skips when checkout has not been opened", () => {
    expect(
      decideCheckoutRecoveryEmail(
        base({ checkoutAttempt: false, checkoutCreatedAt: null, paymentStatus: "unpaid" }),
        delayMs,
        now,
      ),
    ).toEqual({ action: "skip", reason: "not_checkout_created" });
  });

  it("skips until about 60 minutes after checkout created", () => {
    expect(
      decideCheckoutRecoveryEmail(base({ checkoutCreatedAt: minutesAgo(59) }), delayMs, now),
    ).toEqual({ action: "skip", reason: "checkout_delay" });
  });

  it("sends once checkout has been open about 60 minutes and is still unpaid", () => {
    expect(decideCheckoutRecoveryEmail(base({ checkoutCreatedAt: minutesAgo(60) }), delayMs, now)).toEqual(
      { action: "send" },
    );
  });

  it("sends only once per application", () => {
    expect(decideCheckoutRecoveryEmail(base({ alreadySent: true }), delayMs, now)).toEqual({
      action: "skip",
      reason: "already_sent",
    });
  });
});
