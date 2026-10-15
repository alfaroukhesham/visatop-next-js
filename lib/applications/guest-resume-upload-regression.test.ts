import { describe, expect, it } from "vitest";
import { generateResumeToken, guestResumeTokenMatches } from "@/lib/applications/resume-token";
import { redeemLockedGuestResumeParty } from "@/lib/applications/resume-email-link";

/**
 * Reproduces 2026-10-15: guest opened the resume link (which used to rotate on GET),
 * then the original tab uploaded a passport and got HTTP 403 missing resume session.
 */
describe("resume link then document upload session", () => {
  const now = new Date("2026-10-15T12:10:41Z");
  const original = generateResumeToken();
  const party = {
    id: "party-ef399bb5",
    draftExpiresAt: new Date("2026-10-16T00:31:00Z"),
    paymentStatus: "unpaid",
    resumeTokenHash: original.hash,
    previousResumeTokenHash: null,
    previousResumeTokenExpiresAt: null,
  };

  it("keeps the original tab cookie valid after the resume link is redeemed without that cookie", () => {
    const rotated = generateResumeToken();
    const redeemed = redeemLockedGuestResumeParty({
      party,
      memberIds: new Set(["ef399bb5-88bf-42a9-ad9f-7f167a21919f"]),
      primaryApplicationId: "ef399bb5-88bf-42a9-ad9f-7f167a21919f",
      incomingPlain: null,
      now,
      generateToken: () => rotated,
    });
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;

    const tabStillWorks = guestResumeTokenMatches(
      original.plainToken,
      {
        resumeTokenHash: redeemed.nextHash,
        previousResumeTokenHash: redeemed.previousHash,
        previousResumeTokenExpiresAt: redeemed.previousExpiresAt,
      },
      now,
    );
    expect(tabStillWorks).toBe(true);
  });

  it("does not rotate when the resume POST already has the live cookie, so upload stays authorized", () => {
    const redeemed = redeemLockedGuestResumeParty({
      party,
      memberIds: new Set(["app-1"]),
      primaryApplicationId: "app-1",
      incomingPlain: original.plainToken,
      now,
    });
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;
    expect(redeemed.rotated).toBe(false);
    expect(
      guestResumeTokenMatches(original.plainToken, {
        resumeTokenHash: redeemed.nextHash,
        previousResumeTokenHash: redeemed.previousHash,
        previousResumeTokenExpiresAt: redeemed.previousExpiresAt,
      }, now),
    ).toBe(true);
  });
});
