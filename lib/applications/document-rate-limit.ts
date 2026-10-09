/**
 * Guest document rate-limit primitives (spec §13).
 *
 * MVP implementation uses in-process counters: each Node process keeps a map
 * of `bucket:key -> timestamp[]`. On serverless (multiple instances / cold
 * starts) limits are **best-effort per instance** — the spec numbers are
 * targets, not globally exact. Stretch upgrade path: swap the backing store
 * for Redis/Upstash/KV with atomic INCR + EXPIRE, keeping the public API
 * (`consume` / `inspect` / `resetAllForTests`) unchanged.
 *
 * Dual counters: every `consume` accepts ({ ip, applicationId }). A request
 * is rejected if **either** bucket is at its limit — the stricter counter
 * wins. Preview/download GETs must not call `consume` (views are not writes).
 */

export type RateLimitBucket = "UPLOAD_PREVIEW" | "EXTRACT";

export type RateLimitConfig = {
  /** Max hits per application (draft) within `windowMs`. */
  limit: number;
  /** Max hits per IP within `windowMs` (burst across drafts). */
  ipLimit: number;
  /** Sliding window in ms. */
  windowMs: number;
};

/** Generous write limits so retries + replacements do not lock a guest out. */
export const RATE_LIMITS: Record<RateLimitBucket, RateLimitConfig> = {
  UPLOAD_PREVIEW: { limit: 40, ipLimit: 80, windowMs: 60 * 60 * 1000 },
  EXTRACT: { limit: 15, ipLimit: 30, windowMs: 60 * 60 * 1000 },
};

export type RateLimitDecision =
  | {
      ok: true;
      /** After consume, remaining hits per scope (min across scopes). */
      remaining: number;
      /** Millis until the oldest hit in the tightest scope drops off. */
      retryAfterMs: 0;
    }
  | {
      ok: false;
      /** Which scope tripped first. */
      scope: "ip" | "applicationId";
      remaining: 0;
      /** Millis until the tightest counter frees a slot. */
      retryAfterMs: number;
    };

type Key = { ip: string; applicationId: string };

// Map: `${bucket}:${scope}:${value}` -> ring-buffer timestamps (ms).
const counters = new Map<string, number[]>();

function scopeKey(bucket: RateLimitBucket, scope: "ip" | "applicationId", value: string) {
  return `${bucket}:${scope}:${value}`;
}

function prune(arr: number[], cutoff: number): number[] {
  if (arr.length === 0 || arr[0] >= cutoff) return arr;
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i++;
  return arr.slice(i);
}

export function formatRetryAfterWait(retryAfterMs: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  if (seconds < 90) return "about a minute";
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/**
 * Peek dual-counter state without consuming. Useful for emitting rate-limit
 * headers alongside a successful response.
 */
export function inspect(
  bucket: RateLimitBucket,
  key: Key,
  now: number = Date.now(),
): {
  ipCount: number;
  applicationIdCount: number;
  limit: number;
  ipLimit: number;
  windowMs: number;
} {
  const cfg = RATE_LIMITS[bucket];
  const cutoff = now - cfg.windowMs;
  const ipArr = prune(counters.get(scopeKey(bucket, "ip", key.ip)) ?? [], cutoff);
  const appArr = prune(
    counters.get(scopeKey(bucket, "applicationId", key.applicationId)) ?? [],
    cutoff,
  );
  return {
    ipCount: ipArr.length,
    applicationIdCount: appArr.length,
    limit: cfg.limit,
    ipLimit: cfg.ipLimit,
    windowMs: cfg.windowMs,
  };
}

/**
 * Try to record one hit against both scopes. If either scope is already at
 * its limit, the hit is NOT recorded and we return `{ ok: false }` with
 * `retryAfterMs` for the tightest scope.
 */
export function consume(
  bucket: RateLimitBucket,
  key: Key,
  now: number = Date.now(),
): RateLimitDecision {
  const cfg = RATE_LIMITS[bucket];
  const cutoff = now - cfg.windowMs;

  const ipK = scopeKey(bucket, "ip", key.ip);
  const appK = scopeKey(bucket, "applicationId", key.applicationId);
  const ipArr = prune(counters.get(ipK) ?? [], cutoff);
  const appArr = prune(counters.get(appK) ?? [], cutoff);

  if (ipArr.length >= cfg.ipLimit) {
    counters.set(ipK, ipArr);
    const oldest = ipArr[0];
    return {
      ok: false,
      scope: "ip",
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + cfg.windowMs - now),
    };
  }
  if (appArr.length >= cfg.limit) {
    counters.set(appK, appArr);
    const oldest = appArr[0];
    return {
      ok: false,
      scope: "applicationId",
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + cfg.windowMs - now),
    };
  }

  ipArr.push(now);
  appArr.push(now);
  counters.set(ipK, ipArr);
  counters.set(appK, appArr);

  const remaining = Math.min(cfg.ipLimit - ipArr.length, cfg.limit - appArr.length);
  return { ok: true, remaining, retryAfterMs: 0 };
}

/** Test helper. Never call from production code paths. */
export function __resetRateLimiterForTests() {
  counters.clear();
}
