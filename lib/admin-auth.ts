import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as adminSchema from "@/lib/db/schema/admin-auth";

const baseURL = (
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

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
  },
  plugins: [nextCookies(), dash()],
});

