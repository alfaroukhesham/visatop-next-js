/**
 * Canonical site origin for metadata, redirects, and links.
 * Prefer NEXT_PUBLIC_APP_URL; fall back to BETTER_AUTH_URL for server-only contexts.
 */
export function getAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
