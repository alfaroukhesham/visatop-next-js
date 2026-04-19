import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetGuestLinkRateLimiterForTests,
  consumeGuestLinkRateLimit,
} from "./guest-link-rate-limit";

describe("guest-link-rate-limit", () => {
  beforeEach(() => {
    __resetGuestLinkRateLimiterForTests();
  });

  it("prepare: allows under ip and applicationId caps", () => {
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) {
      expect(
        consumeGuestLinkRateLimit(
          { bucket: "PREPARE_GUEST_LINK", ip: "1.1.1.1", applicationId: "app-a" },
          t0 + i,
        ).ok,
      ).toBe(true);
    }
  });

  it("prepare: trips ip floor at 60", () => {
    const t0 = Date.now();
    for (let i = 0; i < 60; i++) {
      consumeGuestLinkRateLimit(
        { bucket: "PREPARE_GUEST_LINK", ip: "2.2.2.2", applicationId: `app-${i}` },
        t0 + i,
      );
    }
    const d = consumeGuestLinkRateLimit(
      { bucket: "PREPARE_GUEST_LINK", ip: "2.2.2.2", applicationId: "app-x" },
      t0 + 60,
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.scope).toBe("ip");
  });

  it("link: trips userId floor at 60", () => {
    const t0 = Date.now();
    for (let i = 0; i < 60; i++) {
      consumeGuestLinkRateLimit(
        { bucket: "LINK_AFTER_AUTH", ip: `10.0.0.${i % 200}`, userId: "user-z" },
        t0 + i,
      );
    }
    const d = consumeGuestLinkRateLimit(
      { bucket: "LINK_AFTER_AUTH", ip: "10.0.1.1", userId: "user-z" },
      t0 + 60,
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.scope).toBe("userId");
  });
});
