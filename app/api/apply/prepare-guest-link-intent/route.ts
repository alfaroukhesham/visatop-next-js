import { headers } from "next/headers";
import { z } from "zod";
import { assertTrustedJsonPostOrigin } from "@/lib/api/json-post-origin";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { extractClientIp } from "@/lib/applications/client-ip";
import { canMintGuestLinkIntent } from "@/lib/applications/guest-link-gating";
import {
  buildLinkIntentSetCookieValue,
  isGuestLinkIntentSecretConfigured,
  signGuestLinkIntent,
} from "@/lib/applications/guest-link-intent";
import { consumeGuestLinkRateLimit } from "@/lib/applications/guest-link-rate-limit";
import { loadGuestApplicationRowByResumeCookie } from "@/lib/applications/guest-resume-access";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ applicationId: z.string().uuid() }).strict();

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  if (process.env.GUEST_LINK_AFTER_AUTH_ENABLED === "false") {
    return jsonError("SERVICE_UNAVAILABLE", "Guest link is temporarily unavailable.", {
      status: 503,
      requestId,
    });
  }

  if (!isGuestLinkIntentSecretConfigured()) {
    return jsonError(
      "SERVICE_UNAVAILABLE",
      "Guest account linking is not configured: set GUEST_LINK_INTENT_SECRET (32+ bytes UTF-8) in the server environment.",
      {
        status: 503,
        requestId,
        details: { code: "GUEST_LINK_INTENT_NOT_CONFIGURED" },
      },
    );
  }

  const originBlock = assertTrustedJsonPostOrigin(req, requestId);
  if (originBlock) return originBlock;

  const parsed = await parseJsonBody(req, bodySchema, requestId);
  if (!parsed.ok) return parsed.response;

  const ip = extractClientIp(hdrs);
  const rl = consumeGuestLinkRateLimit({
    bucket: "PREPARE_GUEST_LINK",
    ip,
    applicationId: parsed.data.applicationId,
  });
  if (!rl.ok) {
    return jsonError("RATE_LIMITED", "Too many requests.", {
      status: 429,
      requestId,
      headers: {
        "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
      },
    });
  }

  const cookieHeader = req.headers.get("cookie");
  const token = readResumeTokenFromRequestCookies(cookieHeader);
  if (!token) {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }

  const row = await loadGuestApplicationRowByResumeCookie(parsed.data.applicationId, token);
  if (!row) {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }

  const mint = canMintGuestLinkIntent({
    paymentStatus: row.paymentStatus,
    applicationStatus: row.applicationStatus,
    userId: row.userId,
    isGuest: row.isGuest,
    adminAttentionRequired: row.adminAttentionRequired,
  });
  if (!mint.ok) {
    const code = mint.reason === "intent_requires_paid" ? "INTENT_REQUIRES_PAID" : "LINK_NOT_ALLOWED";
    return jsonError("CONFLICT", "Intent cannot be created for this application.", {
      status: 409,
      requestId,
      details: { code },
    });
  }

  let plainIntent: string;
  try {
    plainIntent = signGuestLinkIntent(parsed.data.applicationId);
  } catch {
    return jsonError("INTERNAL_ERROR", "Server misconfiguration", { status: 500, requestId });
  }

  return jsonOk(
    { prepared: true, applicationId: parsed.data.applicationId },
    {
      requestId,
      headers: {
        "Set-Cookie": buildLinkIntentSetCookieValue(plainIntent),
      },
    },
  );
}
