import { headers } from "next/headers";
import { consumeResumeEmailLink } from "@/lib/applications/resume-email-link";
import { buildResumeSetCookieValue } from "@/lib/applications/resume-cookie";
import { appHref } from "@/lib/app-href";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t")?.trim();
  const invalidRedirect = appHref("/apply/resume?invalid=1");

  if (!token) {
    return Response.redirect(invalidRedirect, 302);
  }

  const consumed = await consumeResumeEmailLink(token);
  if (!consumed.ok) {
    return Response.redirect(invalidRedirect, 302);
  }

  const hdrs = await headers();
  const secure = process.env.NODE_ENV === "production";
  const setCookie = buildResumeSetCookieValue(consumed.plainToken, consumed.maxAgeSeconds, { secure });
  const destination = appHref(`/apply/applications/${consumed.primaryApplicationId}`);

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      "Set-Cookie": setCookie,
      "Cache-Control": "no-store",
      ...(hdrs.get("x-request-id") ? { "x-request-id": hdrs.get("x-request-id")! } : {}),
    },
  });
};
