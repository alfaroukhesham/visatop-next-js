/**
 * Best-effort in-process rate limit for the customer analytics beacon.
 * Serverless instances do not share this Map; it still bounds a noisy single process.
 */

export type TBeaconRateLimitDecision = { ok: true } | { ok: false; retryAfterMs: number };

const WINDOW_MS = 60 * 1000;
const IP_LIMIT = 120;
const SESSION_LIMIT = 60;

const counters = new Map<string, number[]>();

const prune = (arr: number[], cutoff: number): number[] => {
  if (arr.length === 0 || arr[0]! >= cutoff) return arr;
  let i = 0;
  while (i < arr.length && arr[i]! < cutoff) i += 1;
  return arr.slice(i);
};

export const consumeBeaconRateLimit = (
  ip: string,
  sessionId: string,
  now = Date.now(),
): TBeaconRateLimitDecision => {
  const cutoff = now - WINDOW_MS;
  const ipKey = `ip:${ip}`;
  const sessionKey = `sid:${sessionId}`;
  const ipArr = prune(counters.get(ipKey) ?? [], cutoff);
  const sidArr = prune(counters.get(sessionKey) ?? [], cutoff);
  if (ipArr.length >= IP_LIMIT) {
    counters.set(ipKey, ipArr);
    return { ok: false, retryAfterMs: Math.max(0, ipArr[0]! + WINDOW_MS - now) };
  }
  if (sidArr.length >= SESSION_LIMIT) {
    counters.set(sessionKey, sidArr);
    return { ok: false, retryAfterMs: Math.max(0, sidArr[0]! + WINDOW_MS - now) };
  }
  ipArr.push(now);
  sidArr.push(now);
  counters.set(ipKey, ipArr);
  counters.set(sessionKey, sidArr);
  return { ok: true };
};

export const __resetBeaconRateLimitForTests = (): void => {
  counters.clear();
};
