import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as clientSchema from "@/lib/db/schema/auth";
import { isFacebookOAuthConfigured } from "@/lib/social-oauth";

const appBaseURL = (
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

// Better Auth expects the base URL of the auth handler (not just the site origin).
// With `basePath`, BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL should already include it (e.g. /visa-processing).
const baseURL = `${appBaseURL}/api/auth`;

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

/**
 * CSRF / origin checks (see formCsrfMiddleware) require the browser Origin to
 * be trusted. Tunnel hosts (ngrok) and preview URLs must be included — env
 * alone is not enough if BETTER_AUTH_URL still points at localhost.
 */
async function resolveTrustedOrigins(request?: Request) {
  const origins = new Set<string>();

  const add = (raw?: string | null) => {
    const o = raw ? normalizeOrigin(raw) : null;
    if (o) origins.add(o);
  };

  // `baseURL` includes `/api/auth`; origin checks should use the app base.
  add(appBaseURL);
  add(process.env.BETTER_AUTH_URL);
  add(process.env.NEXT_PUBLIC_APP_URL);
  add("http://localhost:3000");
  add("http://127.0.0.1:3000");

  if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
    for (const part of process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")) {
      add(part.trim());
    }
  }

  if (request) {
    const headerOrigin = request.headers.get("origin");
    if (headerOrigin && headerOrigin !== "null") {
      add(headerOrigin);
    }

    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();

    if (forwardedHost) {
      const proto =
        forwardedProto && forwardedProto !== "" ? forwardedProto : "https";
      add(`${proto}://${forwardedHost}`);
    }

    try {
      add(new URL(request.url).origin);
    } catch {
      /* ignore */
    }
  }

  return [...origins];
}

export const auth = betterAuth({
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: clientSchema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: resolveTrustedOrigins,
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    ...(isFacebookOAuthConfigured()
      ? {
          facebook: {
            clientId: process.env.FACEBOOK_CLIENT_ID as string,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
          },
        }
      : {}),
  },
  advanced: {
    cookiePrefix: "client",
  },
  plugins: [nextCookies(), dash()],
});
