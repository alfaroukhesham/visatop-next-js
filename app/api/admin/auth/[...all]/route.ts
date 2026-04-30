import { adminAuth } from "@/lib/admin-auth";
import { appHref } from "@/lib/app-href";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const handlers = toNextJsHandler(adminAuth);

/**
 * Next.js may strip `basePath` from `req.nextUrl.pathname` before route handlers see it.
 * Better Auth relies on the request URL reflecting the public basePath — same idea as
 * `app/api/auth/[[...all]]/route.ts`, but the rewrite base must match `admin-auth` `baseURL`
 * from `appHref` (includes Next `basePath`).
 */
function rewriteUnderPublicBase(req: NextRequest): NextRequest {
  const appRoot = appHref("/").replace(/\/$/, "");
  const { pathname, search } = req.nextUrl;
  const url = new URL(`${appRoot}${pathname}`);
  url.search = search;
  return new NextRequest(url, req);
}

export async function GET(req: NextRequest) {
  return handlers.GET(rewriteUnderPublicBase(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(rewriteUnderPublicBase(req));
}

