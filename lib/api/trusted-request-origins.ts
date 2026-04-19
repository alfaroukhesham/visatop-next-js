/**
 * Builds the same-origin allowlist used for state-changing JSON POSTs (guest
 * link, etc.), aligned with Better Auth trusted origin rules in `lib/auth.ts`.
 */
function normalizeOrigin(input: string): string | null {
  const trimmed = input.replace(/\/$/, "").trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    try {
      const withProto = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
      return new URL(withProto).origin;
    } catch {
      return null;
    }
  }
}

const baseURL = (
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

export function trustedOriginsForRequest(request: Request): Set<string> {
  const origins = new Set<string>();

  const add = (raw?: string | null) => {
    const o = raw ? normalizeOrigin(raw) : null;
    if (o) origins.add(o);
  };

  add(baseURL);
  add(process.env.BETTER_AUTH_URL);
  add(process.env.NEXT_PUBLIC_APP_URL);
  add("http://localhost:3000");
  add("http://127.0.0.1:3000");

  if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
    for (const part of process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")) {
      add(part.trim());
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto && forwardedProto !== "" ? forwardedProto : "https";
    add(`${proto}://${forwardedHost}`);
  }

  try {
    add(new URL(request.url).origin);
  } catch {
    /* ignore */
  }

  return origins;
}
