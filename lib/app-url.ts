/**
 * Canonical site origin for metadata, redirects, and links.
 * Prefer NEXT_PUBLIC_APP_URL; fall back to BETTER_AUTH_URL for server-only contexts.
 */
export function getAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:3000";
  const trimmed = raw.replace(/\/$/, "");
  try {
    // Env URLs sometimes include Next `basePath` (e.g. https://visatop.com/visa-processing).
    // Callers like `appHref` will append `basePath` again, so we must return only the origin.
    return new URL(trimmed).origin;
  } catch {
    // Fallback: preserve prior behavior for non-URL inputs.
    return trimmed;
  }
}
