import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
}));

vi.mock("./load-candidates", () => ({
  loadCheckoutRecoveryCandidates: vi.fn(),
}));

vi.mock("./send", () => ({
  sendCheckoutRecoveryEmail: vi.fn(),
}));

import { loadCheckoutRecoveryCandidates } from "./load-candidates";
import { sendCheckoutRecoveryEmail } from "./send";
import { runCheckoutRecoveryEmailJob } from "./run";
import type { TCheckoutRecoveryLoaded } from "./load-candidates";

const now = new Date("2026-11-05T12:00:00.000Z");

const loaded = (overrides: Partial<TCheckoutRecoveryLoaded> = {}): TCheckoutRecoveryLoaded => ({
  applicationId: "app-1",
  partyId: "party-1",
  isGuest: true,
  to: "guest@example.com",
  locale: "en",
  fullName: "Sara Ahmed",
  visaName: "30-day tourist visa",
  reference: "VT-123",
  draftExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
  paymentProvider: "ziina",
  amountMinor: BigInt(14900),
  currency: "USD",
  candidate: {
    hasEmail: true,
    isGuest: true,
    guestResumeReady: true,
    applicationStatus: "ready_for_payment",
    paymentStatus: "checkout_created",
    latestPaymentStatus: "checkout_created",
    checkoutAttempt: true,
    checkoutCreatedAt: new Date(now.getTime() - 60 * 60_000),
    alreadySent: false,
  },
  ...overrides,
});

describe("runCheckoutRecoveryEmailJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RECOVERY_EMAILS_ENABLED;
  });

  it("no-ops while the feature flag is off", async () => {
    const result = await runCheckoutRecoveryEmailJob({ now });
    expect(result).toEqual({ enabled: false, considered: 0, sent: 0, skipped: 0, failed: 0 });
    expect(loadCheckoutRecoveryCandidates).not.toHaveBeenCalled();
  });

  it("sends when checkout has been open 60 minutes and unpaid", async () => {
    process.env.RECOVERY_EMAILS_ENABLED = "true";
    vi.mocked(loadCheckoutRecoveryCandidates).mockResolvedValue([loaded()]);
    vi.mocked(sendCheckoutRecoveryEmail).mockResolvedValue({ ok: true, claimed: true });
    const result = await runCheckoutRecoveryEmailJob({ now });
    expect(result.enabled).toBe(true);
    expect(result.sent).toBe(1);
    expect(sendCheckoutRecoveryEmail).toHaveBeenCalledTimes(1);
  });

  it("does not send a generic continue email when checkout was never opened", async () => {
    process.env.RECOVERY_EMAILS_ENABLED = "true";
    vi.mocked(loadCheckoutRecoveryCandidates).mockResolvedValue([
      loaded({
        candidate: {
          hasEmail: true,
          isGuest: true,
          guestResumeReady: true,
          applicationStatus: "draft",
          paymentStatus: "unpaid",
          latestPaymentStatus: null,
          checkoutAttempt: false,
          checkoutCreatedAt: null,
          alreadySent: false,
        },
      }),
    ]);
    const result = await runCheckoutRecoveryEmailJob({ now });
    expect(result.skipped).toBe(1);
    expect(sendCheckoutRecoveryEmail).not.toHaveBeenCalled();
  });
});
