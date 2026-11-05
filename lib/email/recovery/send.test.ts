import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/applications/resume-email-link", () => ({
  isResumeEmailLinkSecretConfigured: () => true,
  signResumeEmailLink: () => "signed-token",
}));

import { checkoutRecoveryCtaUrl } from "./send";

describe("checkoutRecoveryCtaUrl", () => {
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

  it("falls back to the payment URL when the guest draft has expired", () => {
    const url = checkoutRecoveryCtaUrl({
      partyId: "party-1",
      applicationId: "app-1",
      draftExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      isGuest: true,
      now: new Date("2026-11-05T12:00:00.000Z"),
    });
    expect(url).toContain("/apply/applications/app-1/payment");
  });
});
