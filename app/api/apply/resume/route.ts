import { headers } from "next/headers";
import { consumeResumeEmailLink } from "@/lib/applications/resume-email-link";
import {
  buildResumeCookieHeaders,
  readResumeTokensFromRequestCookies,
} from "@/lib/applications/resume-cookie";
import { appHref } from "@/lib/app-href";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const invalidRedirect = () => appHref("/apply/resume?invalid=1");

const resumePageRedirect = (token: string) => {
  const qs = new URLSearchParams({ t: token });
  return appHref(`/apply/resume?${qs.toString()}`);
};

const readSignedToken = async (req: Request): Promise<string | null> => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    return url.searchParams.get("t")?.trim() || null;
  }
  try {
    const form = await req.formData();
    const raw = form.get("t");
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
};

/** Prefetch / crawler GET must not rotate the guest session. */
export const GET = async (req: Request) => {
  const token = await readSignedToken(req);
  if (!token) {
    return Response.redirect(invalidRedirect(), 302);
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: resumePageRedirect(token),
      "Cache-Control": "no-store",
    },
  });
};

/** Actual redeem: rotate only when the browser has no valid current/previous cookie. */
export const POST = async (req: Request) => {
  const token = await readSignedToken(req);
  if (!token) {
    return Response.redirect(invalidRedirect(), 303);
  }

  const incomingPlains = readResumeTokensFromRequestCookies(req.headers.get("cookie"));
  const consumed = await consumeResumeEmailLink(token, incomingPlains);
  if (!consumed.ok) {
    return Response.redirect(invalidRedirect(), 303);
  }

  const hdrs = await headers();
  const destination = appHref(`/apply/applications/${consumed.primaryApplicationId}`);
  const out = new Headers();
  out.set("Location", destination);
  out.set("Cache-Control", "no-store");
  if (hdrs.get("x-request-id")) out.set("x-request-id", hdrs.get("x-request-id")!);
  if (!consumed.skipCookie && consumed.plainToken) {
    const cookieHeaders = buildResumeCookieHeaders(consumed.plainToken, consumed.maxAgeSeconds, {
      secure: process.env.NODE_ENV === "production",
    });
    for (const cookie of cookieHeaders.getSetCookie()) out.append("Set-Cookie", cookie);
  }

  return new Response(null, {
    status: 303,
    headers: out,
  });
};
