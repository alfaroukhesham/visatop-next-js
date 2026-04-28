import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const handlers = toNextJsHandler(auth);

function resolvePublicAppBase(): string {
  const raw =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

/**
 * Next.js may strip `basePath` from `req.nextUrl.pathname` before route handlers see it.
 * Better Auth (and infra dash endpoints) rely on the request URL reflecting the public basePath.
 * Rewrite the request URL back under the public base before passing to Better Auth.
 */
function rewriteUnderPublicBase(req: NextRequest): NextRequest {
  const base = resolvePublicAppBase();
  const { pathname, search } = req.nextUrl;
  const url = new URL(`${base}${pathname}`);
  url.search = search;
  return new NextRequest(url, req);
}

export async function GET(req: NextRequest) {
  return handlers.GET(rewriteUnderPublicBase(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(rewriteUnderPublicBase(req));
}

