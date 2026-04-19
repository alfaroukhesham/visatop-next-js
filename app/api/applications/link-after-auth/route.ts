import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertTrustedJsonPostOrigin } from "@/lib/api/json-post-origin";
import { jsonError, jsonOk } from "@/lib/api/response";
import { extractClientIp } from "@/lib/applications/client-ip";
import { guestLinkMatrixAllowsLink } from "@/lib/applications/guest-link-gating";
import {
  buildLinkIntentClearCookieValue,
  isGuestLinkIntentSecretConfigured,
  readLinkIntentFromRequestCookies,
  verifyGuestLinkIntent,
} from "@/lib/applications/guest-link-intent";
import { consumeGuestLinkRateLimit } from "@/lib/applications/guest-link-rate-limit";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";
import { verifyResumeToken } from "@/lib/applications/resume-token";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application, auditLog } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clearIntentHeaders = { "Set-Cookie": buildLinkIntentClearCookieValue() };

function normalizeEmail(v: string | null | undefined): string | null {
  if (v == null || !v.trim()) return null;
  return v.trim().toLowerCase();
}

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

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) {
    return jsonError("UNAUTHORIZED", "Unauthorized", { status: 401, requestId });
  }

  const ip = extractClientIp(hdrs);
  const rl = consumeGuestLinkRateLimit({
    bucket: "LINK_AFTER_AUTH",
    ip,
    userId: session.user.id,
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

  const intentRaw = readLinkIntentFromRequestCookies(req.headers.get("cookie"));
  if (!intentRaw) {
    return jsonError("VALIDATION_ERROR", "Invalid guest link intent.", {
      status: 422,
      requestId,
      details: { code: "GUEST_LINK_INTENT_INVALID" },
      headers: clearIntentHeaders,
    });
  }

  const verified = verifyGuestLinkIntent(intentRaw);
  if (!verified.ok) {
    return jsonError("VALIDATION_ERROR", "Invalid guest link intent.", {
      status: 422,
      requestId,
      details: { code: "GUEST_LINK_INTENT_INVALID" },
      headers: clearIntentHeaders,
    });
  }

  const U = session.user.id;
  const userEmail = normalizeEmail(session.user.email);
  const resumePlain = readResumeTokenFromRequestCookies(req.headers.get("cookie"));

  type LinkTxResult =
    | { kind: "not_found" }
    | { kind: "already" }
    | { kind: "other_owner" }
    | { kind: "resume_required" }
    | { kind: "resume_mismatch" }
    | { kind: "not_allowed" }
    | { kind: "ok"; emailsDiffer: boolean };

  const txResult: LinkTxResult = await withSystemDbActor(async (tx) => {
    const rows = await tx
      .select()
      .from(application)
      .where(eq(application.id, verified.applicationId))
      .for("update")
      .limit(1);
    const row = rows[0];
    if (!row) return { kind: "not_found" } as const;

    if (row.userId === U && row.isGuest === false) {
      return { kind: "already" } as const;
    }
    if (row.userId != null && row.userId !== U) {
      return { kind: "other_owner" } as const;
    }

    if (row.userId == null) {
      if (!resumePlain) {
        return { kind: "resume_required" } as const;
      }
      if (!row.resumeTokenHash || !verifyResumeToken(resumePlain, row.resumeTokenHash)) {
        return { kind: "resume_mismatch" } as const;
      }
    }

    const matrix = guestLinkMatrixAllowsLink({
      paymentStatus: row.paymentStatus,
      applicationStatus: row.applicationStatus,
      userId: row.userId,
      isGuest: row.isGuest,
      adminAttentionRequired: row.adminAttentionRequired,
    });
    if (!matrix.ok) {
      return { kind: "not_allowed" } as const;
    }

    const guestEmail = normalizeEmail(row.guestEmail);
    const emailsDiffer = Boolean(userEmail && guestEmail && userEmail !== guestEmail);

    const updated = await tx
      .update(application)
      .set({
        userId: U,
        isGuest: false,
        resumeTokenHash: null,
        adminAttentionRequired: row.adminAttentionRequired || emailsDiffer,
        updatedAt: new Date(),
      })
      .where(and(eq(application.id, row.id), isNull(application.userId)))
      .returning({ id: application.id });

    if (!updated[0]) {
      return { kind: "not_allowed" } as const;
    }

    // RLS insert uses `withSystemDbActor` (policy `audit_log_system_insert`). The
    // human actor is the signed-in user `U` verified above — store on `actor_id`
    // for indexing; `after_json` carries the same id for the link outcome.
    await tx.insert(auditLog).values({
      actorType: "system",
      actorId: U,
      action: "guest_application_linked",
      entityType: "application",
      entityId: row.id,
      beforeJson: null,
      afterJson: JSON.stringify({
        userId: U,
        isGuest: false,
        resumeCleared: true,
        emailsDiffer,
      }),
    });

    return { kind: "ok", emailsDiffer } as const;
  });

  switch (txResult.kind) {
    case "not_found":
      return jsonError("NOT_FOUND", "Application not found", {
        status: 404,
        requestId,
        headers: clearIntentHeaders,
      });
    case "already":
      return jsonOk({ alreadyLinked: true }, { requestId, headers: clearIntentHeaders });
    case "other_owner":
      return jsonError("CONFLICT", "Link not allowed.", {
        status: 409,
        requestId,
        details: { code: "LINK_NOT_ALLOWED" },
        headers: clearIntentHeaders,
      });
    case "resume_required":
      return jsonError("FORBIDDEN", "Resume session required.", {
        status: 403,
        requestId,
        details: { code: "LINK_RESUME_REQUIRED" },
        headers: clearIntentHeaders,
      });
    case "resume_mismatch":
      return jsonError("FORBIDDEN", "Resume session does not match intent.", {
        status: 403,
        requestId,
        details: { code: "LINK_INTENT_RESUME_MISMATCH" },
        headers: clearIntentHeaders,
      });
    case "not_allowed":
      return jsonError("CONFLICT", "Link not allowed.", {
        status: 409,
        requestId,
        details: { code: "LINK_NOT_ALLOWED" },
        headers: clearIntentHeaders,
      });
    case "ok":
      return jsonOk({ linked: true }, { requestId, headers: clearIntentHeaders });
    default: {
      const _exhaustive: never = txResult;
      return _exhaustive;
    }
  }
}
