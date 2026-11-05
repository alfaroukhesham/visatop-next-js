import { describe, expect, it } from "vitest";
import { decideCheckoutRecoveryEmail, type TCheckoutRecoveryCandidate } from "./decide";

const windows = { delayMs: 60 * 60 * 1000, maxAgeMs: 24 * 60 * 60 * 1000 };
const now = new Date("2026-11-05T12:00:00.000Z");
const minutesAgo = (m: number): Date => new Date(now.getTime() - m * 60_000);

const base = (overrides: Partial<TCheckoutRecoveryCandidate> = {}): TCheckoutRecoveryCandidate => ({
  hasEmail: true,
  isGuest: false,
  guestResumeReady: true,
  applicationStatus: "ready_for_payment",
  paymentStatus: "checkout_created",
  latestPaymentStatus: "checkout_created",
  checkoutAttempt: true,
  checkoutCreatedAt: minutesAgo(60),
  alreadySent: false,
  ...overrides,
});

describe("decideCheckoutRecoveryEmail", () => {
  it("skips when there is no recipient email", () => {
    expect(decideCheckoutRecoveryEmail(base({ hasEmail: false }), windows, now)).toEqual({
      action: "skip",
      reason: "no_email",
    });
  });

  it("skips paid, refunded, or refund pending", () => {
    expect(decideCheckoutRecoveryEmail(base({ paymentStatus: "paid" }), windows, now)).toEqual({
      action: "skip",
      reason: "settled_payment",
    });
    expect(decideCheckoutRecoveryEmail(base({ paymentStatus: "refunded" }), windows, now)).toEqual({
      action: "skip",
      reason: "settled_payment",
    });
    expect(
      decideCheckoutRecoveryEmail(base({ paymentStatus: "refund_pending" }), windows, now),
    ).toEqual({ action: "skip", reason: "settled_payment" });
  });

  it("skips cancelled applications", () => {
    expect(
      decideCheckoutRecoveryEmail(base({ applicationStatus: "cancelled" }), windows, now),
    ).toEqual({ action: "skip", reason: "cancelled" });
  });

  it("skips converted / terminal applications", () => {
    expect(
      decideCheckoutRecoveryEmail(base({ applicationStatus: "in_progress" }), windows, now),
    ).toEqual({ action: "skip", reason: "converted" });
    expect(
      decideCheckoutRecoveryEmail(base({ applicationStatus: "completed" }), windows, now),
    ).toEqual({ action: "skip", reason: "converted" });
  });

  it("skips when checkout has not been opened", () => {
    expect(
      decideCheckoutRecoveryEmail(
        base({
          checkoutAttempt: false,
          checkoutCreatedAt: null,
          paymentStatus: "unpaid",
          latestPaymentStatus: null,
        }),
        windows,
        now,
      ),
    ).toEqual({ action: "skip", reason: "checkout_not_open" });
  });

  it("skips reconciled-expired checkouts (app unpaid, payment failed/expired)", () => {
    expect(
      decideCheckoutRecoveryEmail(
        base({
          paymentStatus: "unpaid",
          latestPaymentStatus: "failed",
          checkoutAttempt: true,
          checkoutCreatedAt: minutesAgo(90),
        }),
        windows,
        now,
      ),
    ).toEqual({ action: "skip", reason: "checkout_not_open" });
  });

  it("skips guests who cannot get a resume link", () => {
    expect(
      decideCheckoutRecoveryEmail(
        base({ isGuest: true, guestResumeReady: false }),
        windows,
        now,
      ),
    ).toEqual({ action: "skip", reason: "guest_resume_unavailable" });
  });

  it("skips until about 60 minutes after checkout created", () => {
    expect(
      decideCheckoutRecoveryEmail(base({ checkoutCreatedAt: minutesAgo(59) }), windows, now),
    ).toEqual({ action: "skip", reason: "checkout_delay" });
  });

  it("skips checkouts older than the max-age window", () => {
    expect(
      decideCheckoutRecoveryEmail(base({ checkoutCreatedAt: minutesAgo(24 * 60 + 1) }), windows, now),
    ).toEqual({ action: "skip", reason: "checkout_too_old" });
  });

  it("sends once checkout has been open about 60 minutes and is still unpaid", () => {
    expect(decideCheckoutRecoveryEmail(base({ checkoutCreatedAt: minutesAgo(60) }), windows, now)).toEqual(
      { action: "send" },
    );
  });

  it("sends only once per application", () => {
    expect(decideCheckoutRecoveryEmail(base({ alreadySent: true }), windows, now)).toEqual({
      action: "skip",
      reason: "already_sent",
    });
  });
});
