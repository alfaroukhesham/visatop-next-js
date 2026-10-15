import { describe, expect, it } from "vitest";
import { generateResumeToken, guestResumeTokenMatches } from "./resume-token";
import {
  RESUME_EMAIL_LINK_MAX_TTL_SEC,
  RESUME_TOKEN_GRACE_MS,
  computeResumeEmailLinkExpSec,
  planGuestResumeRedeem,
  redeemLockedGuestResumeParty,
  signResumeEmailLink,
  verifyResumeEmailLink,
} from "./resume-email-link";

const secret = "01234567890123456789012345678901";

describe("resume-email-link", () => {
  it("round-trips partyId and primaryApplicationId", () => {
    const partyId = "party-1111-bbbb-cccc-dddd-eeeeeeeeeeee";
    const primaryApplicationId = "app-2222-bbbb-cccc-dddd-eeeeeeeeeeee";
    const draftExpiresAt = new Date((1_000_000 + RESUME_EMAIL_LINK_MAX_TTL_SEC) * 1000);
    const token = signResumeEmailLink(partyId, primaryApplicationId, draftExpiresAt, {
      secret,
      nowSec: 1_000_000,
    });
    const v = verifyResumeEmailLink(token, { secret, nowSec: 1_000_000 + 10 });
    expect(v).toEqual({ ok: true, partyId, primaryApplicationId });
  });

  it("rejects after exp", () => {
    const partyId = "party-1111-bbbb-cccc-dddd-eeeeeeeeeeee";
    const primaryApplicationId = "app-2222-bbbb-cccc-dddd-eeeeeeeeeeee";
    const draftExpiresAt = new Date((1_000_000 + 3600) * 1000);
    const token = signResumeEmailLink(partyId, primaryApplicationId, draftExpiresAt, {
      secret,
      nowSec: 1_000_000,
    });
    const v = verifyResumeEmailLink(token, { secret, nowSec: 1_000_000 + 3601 });
    expect(v.ok).toBe(false);
  });

  it("rejects tampered mac", () => {
    const partyId = "party-1111-bbbb-cccc-dddd-eeeeeeeeeeee";
    const primaryApplicationId = "app-2222-bbbb-cccc-dddd-eeeeeeeeeeee";
    const draftExpiresAt = new Date((1_000_000 + RESUME_EMAIL_LINK_MAX_TTL_SEC) * 1000);
    let token = signResumeEmailLink(partyId, primaryApplicationId, draftExpiresAt, {
      secret,
      nowSec: 1_000_000,
    });
    token = token.slice(0, -4) + "xxxx";
    expect(verifyResumeEmailLink(token, { secret, nowSec: 1_000_000 }).ok).toBe(false);
  });

  it("computeResumeEmailLinkExpSec caps at 48h and draft expiry", () => {
    const nowSec = 1_000_000;
    const within48h = new Date((nowSec + 3600) * 1000);
    expect(computeResumeEmailLinkExpSec(within48h, nowSec)).toBe(nowSec + 3600);

    const beyond48h = new Date((nowSec + RESUME_EMAIL_LINK_MAX_TTL_SEC + 3600) * 1000);
    expect(computeResumeEmailLinkExpSec(beyond48h, nowSec)).toBe(
      nowSec + RESUME_EMAIL_LINK_MAX_TTL_SEC,
    );
  });
});

describe("guest resume redeem", () => {
  const now = new Date("2026-10-15T12:10:41Z");
  const original = generateResumeToken();
  const partyBase = {
    id: "party-1",
    draftExpiresAt: new Date(now.getTime() + 86_400_000),
    paymentStatus: "unpaid",
    resumeTokenHash: original.hash,
    previousResumeTokenHash: null,
    previousResumeTokenExpiresAt: null,
  };

  it("reuses the cookie when the open tab already has a valid session", () => {
    const plan = planGuestResumeRedeem({
      incomingPlain: original.plainToken,
      currentHash: original.hash,
      previousHash: null,
      previousExpiresAt: null,
      now,
    });
    expect(plan).toEqual({ action: "reuse", plainToken: original.plainToken });

    const redeemed = redeemLockedGuestResumeParty({
      party: partyBase,
      memberIds: new Set(["app-1"]),
      primaryApplicationId: "app-1",
      incomingPlain: original.plainToken,
      now,
    });
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;
    expect(redeemed.rotated).toBe(false);
    expect(redeemed.plainToken).toBe(original.plainToken);
    expect(redeemed.nextHash).toBe(original.hash);
  });

  it("rotates without a cookie but keeps the original token valid during grace", () => {
    const rotated = generateResumeToken();
    const redeemed = redeemLockedGuestResumeParty({
      party: partyBase,
      memberIds: new Set(["app-1"]),
      primaryApplicationId: "app-1",
      incomingPlain: null,
      now,
      generateToken: () => rotated,
    });
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;
    expect(redeemed.rotated).toBe(true);
    expect(redeemed.plainToken).toBe(rotated.plainToken);
    expect(redeemed.previousHash).toBe(original.hash);
    expect(redeemed.previousExpiresAt?.getTime()).toBe(now.getTime() + RESUME_TOKEN_GRACE_MS);
    expect(
      guestResumeTokenMatches(original.plainToken, {
        resumeTokenHash: redeemed.nextHash,
        previousResumeTokenHash: redeemed.previousHash,
        previousResumeTokenExpiresAt: redeemed.previousExpiresAt,
      }, now),
    ).toBe(true);
    expect(
      guestResumeTokenMatches(rotated.plainToken, {
        resumeTokenHash: redeemed.nextHash,
        previousResumeTokenHash: redeemed.previousHash,
        previousResumeTokenExpiresAt: redeemed.previousExpiresAt,
      }, now),
    ).toBe(true);
  });

  it("rejects expired drafts", () => {
    const redeemed = redeemLockedGuestResumeParty({
      party: { ...partyBase, draftExpiresAt: new Date(now.getTime() - 1000) },
      memberIds: new Set(["app-1"]),
      primaryApplicationId: "app-1",
      incomingPlain: original.plainToken,
      now,
    });
    expect(redeemed.ok).toBe(false);
  });
});
