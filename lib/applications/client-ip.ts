/**
 * Extract a reasonable client IP for rate limit keys from Next.js request
 * headers. Order:
 *
 * 1. `x-forwarded-for` (first hop)
 * 2. `x-real-ip`
 * 3. `cf-connecting-ip` (Cloudflare)
 * 4. Fallback constant `"unknown"` so we still get per-IP counters in dev.
 *
 * This is used as a **rate-limit bucket key only** and is NOT safe for
 * authorization. Never log client IP without the existing privacy scrub.
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return "unknown";
}
