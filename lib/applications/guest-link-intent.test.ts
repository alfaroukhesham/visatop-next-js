import { describe, expect, it } from "vitest";
import {
  GUEST_LINK_INTENT_TTL_SEC,
  signGuestLinkIntent,
  verifyGuestLinkIntent,
} from "./guest-link-intent";

const secret = "01234567890123456789012345678901";

describe("guest-link-intent", () => {
  it("round-trips applicationId", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const token = signGuestLinkIntent(id, { secret, nowSec: 1_000_000 });
    const v = verifyGuestLinkIntent(token, { secret, nowSec: 1_000_000 + 10 });
    expect(v).toEqual({ ok: true, applicationId: id });
  });

  it("rejects after exp", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const token = signGuestLinkIntent(id, { secret, nowSec: 1_000_000 });
    const v = verifyGuestLinkIntent(token, {
      secret,
      nowSec: 1_000_000 + GUEST_LINK_INTENT_TTL_SEC + 1,
    });
    expect(v.ok).toBe(false);
  });

  it("rejects tampered mac", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    let token = signGuestLinkIntent(id, { secret, nowSec: 1_000_000 });
    token = token.slice(0, -4) + "xxxx";
    expect(verifyGuestLinkIntent(token, { secret, nowSec: 1_000_000 }).ok).toBe(false);
  });
});
