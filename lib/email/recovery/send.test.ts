import { beforeEach, describe, expect, it, vi } from "vitest";

const resume = vi.hoisted(() => ({
  isResumeEmailLinkSecretConfigured: vi.fn(() => true),
  signResumeEmailLink: vi.fn(() => "signed-token"),
}));

vi.mock("@/lib/applications/resume-email-link", () => resume);

vi.mock("@/lib/email/claim-transactional-email", () => ({
  tryClaimTransactionalEmail: vi.fn(),
  releaseTransactionalEmailClaim: vi.fn(),
}));

vi.mock("@/lib/email/mailgun", () => ({
  isMailgunConfigured: () => true,
  mailgunSendText: vi.fn(),
}));

import {
  releaseTransactionalEmailClaim,
  tryClaimTransactionalEmail,
} from "@/lib/email/claim-transactional-email";
import { mailgunSendText } from "@/lib/email/mailgun";
import { CHECKOUT_RECOVERY_KIND } from "./decide";
import type { TCheckoutRecoveryLoaded } from "./load-candidates";
import { checkoutRecoveryCtaUrl, sendCheckoutRecoveryEmail } from "./send";

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

describe("checkoutRecoveryCtaUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resume.isResumeEmailLinkSecretConfigured.mockReturnValue(true);
  });

  it("links signed-in customers to the payment step", () => {
    const url = checkoutRecoveryCtaUrl({
      partyId: "party-1",
      applicationId: "app-1",
      draftExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
      isGuest: false,
    });
    expect(url).toContain("/apply/applications/app-1/payment");
    expect(url).not.toContain("/apply/resume");
  });

  it("uses a guest resume link that continues into the application (payment redirect)", () => {
    const url = checkoutRecoveryCtaUrl({
      partyId: "party-1",
      applicationId: "app-1",
      draftExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
      isGuest: true,
    });
    expect(url).toContain("/apply/resume?t=signed-token");
  });

  it("does not fall back to the payment URL when the guest draft has expired", () => {
    const url = checkoutRecoveryCtaUrl({
      partyId: "party-1",
      applicationId: "app-1",
      draftExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      isGuest: true,
      now,
    });
    expect(url).toBeNull();
  });

  it("does not fall back to the payment URL when the resume secret is missing", () => {
    resume.isResumeEmailLinkSecretConfigured.mockReturnValue(false);
    const url = checkoutRecoveryCtaUrl({
      partyId: "party-1",
      applicationId: "app-1",
      draftExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
      isGuest: true,
      now,
    });
    expect(url).toBeNull();
  });
});

describe("sendCheckoutRecoveryEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resume.isResumeEmailLinkSecretConfigured.mockReturnValue(true);
  });

  it("skips guests when the resume secret is missing, without claiming", async () => {
    resume.isResumeEmailLinkSecretConfigured.mockReturnValue(false);
    const result = await sendCheckoutRecoveryEmail(loaded(), now);
    expect(result).toEqual({ ok: true, claimed: false, skipped: "guest_resume_unavailable" });
    expect(tryClaimTransactionalEmail).not.toHaveBeenCalled();
    expect(mailgunSendText).not.toHaveBeenCalled();
  });

  it("skips guests when the draft has expired, without claiming", async () => {
    const result = await sendCheckoutRecoveryEmail(
      loaded({ draftExpiresAt: new Date("2020-01-01T00:00:00.000Z") }),
      now,
    );
    expect(result).toEqual({ ok: true, claimed: false, skipped: "guest_resume_unavailable" });
    expect(tryClaimTransactionalEmail).not.toHaveBeenCalled();
  });

  it("clears the claim when Mailgun rejects so the next run can send", async () => {
    vi.mocked(tryClaimTransactionalEmail).mockResolvedValue(true);
    vi.mocked(releaseTransactionalEmailClaim).mockResolvedValue(undefined);
    vi.mocked(mailgunSendText)
      .mockResolvedValueOnce({ ok: false, error: "Mailgun HTTP 500" })
      .mockResolvedValueOnce({ ok: true });

    const first = await sendCheckoutRecoveryEmail(loaded(), now);
    expect(first).toEqual({ ok: false, error: "Mailgun HTTP 500" });
    expect(releaseTransactionalEmailClaim).toHaveBeenCalledWith("app-1", CHECKOUT_RECOVERY_KIND);

    const second = await sendCheckoutRecoveryEmail(loaded(), now);
    expect(second).toEqual({ ok: true, claimed: true });
    expect(tryClaimTransactionalEmail).toHaveBeenCalledTimes(2);
    expect(mailgunSendText).toHaveBeenCalledTimes(2);
  });
});
