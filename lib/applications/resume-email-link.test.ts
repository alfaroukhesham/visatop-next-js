import { describe, expect, it } from "vitest";
import {
  RESUME_EMAIL_LINK_MAX_TTL_SEC,
  computeResumeEmailLinkExpSec,
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
