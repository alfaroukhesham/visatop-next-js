/** Guest resume session cookie (plaintext token is HttpOnly — not in JSON). */
export const RESUME_COOKIE_NAME = "vt_resume";

export function buildResumeSetCookieValue(
  plainToken: string,
  maxAgeSeconds: number,
  opts?: { secure?: boolean },
): string {
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  const parts = [
    `${RESUME_COOKIE_NAME}=${encodeURIComponent(plainToken)}`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readResumeTokenFromRequestCookies(
  cookieHeader: string | null,
  name: string = RESUME_COOKIE_NAME,
): string | null {
  if (!cookieHeader?.trim()) return null;
  const pairs = cookieHeader.split(";").map((p) => p.trim());
  const prefix = `${name}=`;
  for (const p of pairs) {
    if (p.startsWith(prefix)) {
      const raw = p.slice(prefix.length);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

export function buildResumeClearCookieValue(opts?: { secure?: boolean }): string {
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  const parts = [`${RESUME_COOKIE_NAME}=`, "Max-Age=0", "Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
