/**
 * Guest link rate-limit primitives (spec §15).
 *
 * MVP uses the same in-process sliding-window model as `document-rate-limit.ts`:
 * each Node process keeps timestamp rings per key. On serverless / multi-instance
 * deploys, limits are **best-effort per instance** — the §15 numbers are floors,
 * not a globally exact cap until backed by Redis/KV. See `document-rate-limit.ts`
 * header for the full disclaimer.
 */

export type GuestLinkRateBucket = "PREPARE_GUEST_LINK" | "LINK_AFTER_AUTH";

export type GuestLinkRateKey =
  | { bucket: "PREPARE_GUEST_LINK"; ip: string; applicationId: string }
  | { bucket: "LINK_AFTER_AUTH"; ip: string; userId: string };

type Scope = "ip" | "applicationId" | "userId";

export type GuestLinkRateLimitDecision =
  | { ok: true; remaining: number; retryAfterMs: 0 }
  | {
      ok: false;
      scope: Scope;
      remaining: 0;
      retryAfterMs: number;
    };

const LIMITS: Record<
  GuestLinkRateBucket,
  { ip: { limit: number; windowMs: number }; second: { limit: number; windowMs: number } }
> = {
  PREPARE_GUEST_LINK: {
    ip: { limit: 60, windowMs: 60 * 60 * 1000 },
    second: { limit: 120, windowMs: 60 * 60 * 1000 },
  },
  LINK_AFTER_AUTH: {
    ip: { limit: 30, windowMs: 60 * 60 * 1000 },
    second: { limit: 60, windowMs: 60 * 60 * 1000 },
  },
};

const counters = new Map<string, number[]>();

function scopeKey(bucket: GuestLinkRateBucket, scope: Scope, value: string) {
  return `${bucket}:${scope}:${value}`;
}

function prune(arr: number[], cutoff: number): number[] {
  if (arr.length === 0 || arr[0] >= cutoff) return arr;
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i++;
  return arr.slice(i);
}

export function consumeGuestLinkRateLimit(
  key: GuestLinkRateKey,
  now: number = Date.now(),
): GuestLinkRateLimitDecision {
  const cfg = LIMITS[key.bucket];
  const secondScope: Scope = key.bucket === "PREPARE_GUEST_LINK" ? "applicationId" : "userId";
  const secondValue =
    key.bucket === "PREPARE_GUEST_LINK" ? key.applicationId : key.userId;

  const ipK = scopeKey(key.bucket, "ip", key.ip);
  const secK = scopeKey(key.bucket, secondScope, secondValue);

  const ipCfg = cfg.ip;
  const secCfg = cfg.second;
  const ipCutoff = now - ipCfg.windowMs;
  const secCutoff = now - secCfg.windowMs;

  let ipArr = prune(counters.get(ipK) ?? [], ipCutoff);
  let secArr = prune(counters.get(secK) ?? [], secCutoff);

  if (ipArr.length >= ipCfg.limit) {
    counters.set(ipK, ipArr);
    const oldest = ipArr[0];
    return {
      ok: false,
      scope: "ip",
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + ipCfg.windowMs - now),
    };
  }
  if (secArr.length >= secCfg.limit) {
    counters.set(secK, secArr);
    const oldest = secArr[0];
    return {
      ok: false,
      scope: secondScope,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + secCfg.windowMs - now),
    };
  }

  ipArr = [...ipArr, now];
  secArr = [...secArr, now];
  counters.set(ipK, ipArr);
  counters.set(secK, secArr);

  const remaining = Math.min(ipCfg.limit - ipArr.length, secCfg.limit - secArr.length);
  return { ok: true, remaining, retryAfterMs: 0 };
}

/** Vitest helper */
export function __resetGuestLinkRateLimiterForTests() {
  counters.clear();
}
