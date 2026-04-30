/** Same-origin relative paths only; prevents open redirects. */
export function safeCallbackUrl(raw: string | null, fallback = "/portal/track"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}
