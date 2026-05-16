import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuthServerPlugins } from "@/lib/better-auth/server-plugins";
import { apiHref, appHref } from "@/lib/app-href";
import { db } from "@/lib/db";
import * as adminSchema from "@/lib/db/schema/admin-auth";

// Full public URL of the admin auth handler (includes Next `basePath` + `/api/admin/auth`).
// Must match `admin-auth-client` / `apiHref` so Better Auth routing and CSRF checks succeed.
const baseURL = apiHref("admin/auth").replace(/\/$/, "");
const appBaseURL = appHref("/").replace(/\/$/, "");

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

async function resolveTrustedOrigins(request?: Request) {
  const origins = new Set<string>();

  const add = (raw?: string | null) => {
    const o = raw ? normalizeOrigin(raw) : null;
    if (o) origins.add(o);
  };

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
      const proto = forwardedProto && forwardedProto !== "" ? forwardedProto : "https";
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

export const adminAuth = betterAuth({
  basePath: "/api/admin/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: adminSchema.adminUser,
      session: adminSchema.adminSession,
      account: adminSchema.adminAccount,
      verification: adminSchema.adminVerification,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: resolveTrustedOrigins,
  emailAndPassword: { enabled: true, disableSignUp: true },
  advanced: {
    cookiePrefix: "admin",
    // `baseURL` comes from env and is often canonical `https://…` while dev/staging is
    // reached over `http://` (e.g. droplet IP). Better Auth would then emit `Secure`
    // cookies that the browser drops on HTTP — session never appears on `/admin`.
    useSecureCookies:
      process.env.BETTER_AUTH_SECURE_COOKIES === "true"
        ? true
        : process.env.BETTER_AUTH_SECURE_COOKIES === "false"
          ? false
          : process.env.NODE_ENV === "production",
  },
  plugins: betterAuthServerPlugins(),
});

