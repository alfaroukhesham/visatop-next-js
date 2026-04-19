import { afterEach, describe, expect, it } from "vitest";
import {
  __resetRateLimiterForTests,
  consume,
  inspect,
  RATE_LIMITS,
} from "./document-rate-limit";

const IP = "203.0.113.7";
const APP = "app_123";
const OTHER_APP = "app_456";
const OTHER_IP = "198.51.100.2";

afterEach(() => {
  __resetRateLimiterForTests();
});

describe("document-rate-limit consume", () => {
  it("allows up to the limit then rejects with retry-after", () => {
    const { limit, windowMs } = RATE_LIMITS.UPLOAD_PREVIEW;
    const now = 1_000_000;
    for (let i = 0; i < limit; i++) {
      const decision = consume(
        "UPLOAD_PREVIEW",
        { ip: IP, applicationId: APP },
        now + i,
      );
      expect(decision.ok, `hit #${i + 1} should be allowed`).toBe(true);
    }
    const blocked = consume(
      "UPLOAD_PREVIEW",
      { ip: IP, applicationId: APP },
      now + limit,
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
      expect(blocked.retryAfterMs).toBeLessThanOrEqual(windowMs);
    }
  });

  it("rejects when ip scope exceeds even if applicationId is fresh", () => {
    const { limit } = RATE_LIMITS.UPLOAD_PREVIEW;
    const now = 1_000_000;
    for (let i = 0; i < limit; i++) {
      consume("UPLOAD_PREVIEW", { ip: IP, applicationId: APP }, now + i);
    }
    const blocked = consume(
      "UPLOAD_PREVIEW",
      { ip: IP, applicationId: OTHER_APP },
      now + limit,
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.scope).toBe("ip");
  });

  it("rejects when applicationId scope exceeds even if ip rotates", () => {
    const { limit } = RATE_LIMITS.UPLOAD_PREVIEW;
    const now = 1_000_000;
    for (let i = 0; i < limit; i++) {
      consume(
        "UPLOAD_PREVIEW",
        { ip: `ip-${i}`, applicationId: APP },
        now + i,
      );
    }
    const blocked = consume(
      "UPLOAD_PREVIEW",
      { ip: OTHER_IP, applicationId: APP },
      now + limit,
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.scope).toBe("applicationId");
  });

  it("buckets are independent (UPLOAD_PREVIEW vs EXTRACT)", () => {
    const { limit: up } = RATE_LIMITS.UPLOAD_PREVIEW;
    const now = 1_000_000;
    for (let i = 0; i < up; i++) {
      consume("UPLOAD_PREVIEW", { ip: IP, applicationId: APP }, now + i);
    }
    const extract = consume(
      "EXTRACT",
      { ip: IP, applicationId: APP },
      now + up,
    );
    expect(extract.ok).toBe(true);
  });

  it("slides: hits older than windowMs drop off", () => {
    const { limit, windowMs } = RATE_LIMITS.EXTRACT;
    const t0 = 1_000_000;
    for (let i = 0; i < limit; i++) {
      consume("EXTRACT", { ip: IP, applicationId: APP }, t0 + i);
    }
    const immediate = consume(
      "EXTRACT",
      { ip: IP, applicationId: APP },
      t0 + limit,
    );
    expect(immediate.ok).toBe(false);
    const afterWindow = consume(
      "EXTRACT",
      { ip: IP, applicationId: APP },
      t0 + windowMs + 1,
    );
    expect(afterWindow.ok).toBe(true);
  });

  it("does NOT consume a slot when rejected", () => {
    const { limit } = RATE_LIMITS.UPLOAD_PREVIEW;
    const now = 1_000_000;
    for (let i = 0; i < limit; i++) {
      consume("UPLOAD_PREVIEW", { ip: IP, applicationId: APP }, now + i);
    }
    for (let j = 0; j < 5; j++) {
      consume("UPLOAD_PREVIEW", { ip: IP, applicationId: APP }, now + limit + j);
    }
    const inspected = inspect(
      "UPLOAD_PREVIEW",
      { ip: IP, applicationId: APP },
      now + limit + 10,
    );
    expect(inspected.ipCount).toBe(limit);
    expect(inspected.applicationIdCount).toBe(limit);
  });
});

describe("document-rate-limit inspect", () => {
  it("reports current counters without mutating state", () => {
    const now = 1_000_000;
    consume("UPLOAD_PREVIEW", { ip: IP, applicationId: APP }, now);
    const first = inspect(
      "UPLOAD_PREVIEW",
      { ip: IP, applicationId: APP },
      now + 10,
    );
    const second = inspect(
      "UPLOAD_PREVIEW",
      { ip: IP, applicationId: APP },
      now + 10,
    );
    expect(first.ipCount).toBe(1);
    expect(first.applicationIdCount).toBe(1);
    expect(second.ipCount).toBe(1);
    expect(second.applicationIdCount).toBe(1);
  });
});
