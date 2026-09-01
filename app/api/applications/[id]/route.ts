import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { loadGuestApplicationRowByResumeCookie } from "@/lib/applications/guest-resume-access";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";
import { toPublicApplication } from "@/lib/applications/public-application";
import { toPublicApplicationWithCharge } from "@/lib/applications/load-application-charge";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withClientDbActor, withSystemDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchBody = z.strictObject({
  guestEmail: z.email().max(320),
});

async function loadApplicationForGuest(
  applicationId: string,
  resumePlain: string,
): Promise<typeof application.$inferSelect | null> {
  return loadGuestApplicationRowByResumeCookie(applicationId, resumePlain);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const [{ id }, session] = await Promise.all([
    ctx.params,
    auth.api.getSession({ headers: hdrs }),
  ]);

  if (session) {
    const row = await loadApplicationRowForRequest(id, req.headers.get("cookie"));
    if (!row) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonOk({ application: await toPublicApplicationWithCharge(row) }, { requestId });
  }

  const cookieHeader = req.headers.get("cookie");
  const token = readResumeTokenFromRequestCookies(cookieHeader);
  if (!token) {
    // Guest without cookie: 403 (distinct from 404) so clients can distinguish
    // “no possession proof” from unknown id. RSC `/submitted` uses unified 404.
    return jsonError("FORBIDDEN", "Missing resume session", { status: 403, requestId });
  }
  const row = await loadApplicationForGuest(id, token);
  if (!row) {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }
  return jsonOk({ application: await toPublicApplicationWithCharge(row) }, { requestId });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const [{ id }, parsed] = await Promise.all([
    ctx.params,
    parseJsonBody(req, patchBody, requestId),
  ]);
  if (!parsed.ok) return parsed.response;

  const session = await auth.api.getSession({ headers: hdrs });

  if (session) {
    const existing = await loadApplicationRowForRequest(id, req.headers.get("cookie"));
    if (!existing) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    const nextEmail = parsed.data.guestEmail.trim().toLowerCase();

    if (existing.userId === session.user.id) {
      const updated = await withClientDbActor(session.user.id, async (tx) => {
        return tx
          .update(application)
          .set({ guestEmail: nextEmail })
          .where(and(eq(application.id, id), eq(application.userId, session.user.id)))
          .returning();
      });
      const row = updated[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
      }
      return jsonOk({ application: toPublicApplication(row) }, { requestId });
    }

    if (existing.userId == null) {
      const updated = await withSystemDbActor(async (tx) => {
        return tx
          .update(application)
          .set({ guestEmail: nextEmail })
          .where(and(eq(application.id, id), isNull(application.userId)))
          .returning();
      });
      const row = updated[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
      }
      return jsonOk({ application: toPublicApplication(row) }, { requestId });
    }

    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }

  const cookieHeader = req.headers.get("cookie");
  const token = readResumeTokenFromRequestCookies(cookieHeader);
  if (!token) {
    return jsonError("FORBIDDEN", "Missing resume session", { status: 403, requestId });
  }
  const row = await loadApplicationForGuest(id, token);
  if (!row) {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }
  const updated = await withSystemDbActor(async (tx) => {
    return tx
      .update(application)
      .set({ guestEmail: parsed.data.guestEmail.trim().toLowerCase() })
      .where(and(eq(application.id, id), eq(application.isGuest, true)))
      .returning();
  });
  const next = updated[0];
  if (!next) {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }
  return jsonOk({ application: toPublicApplication(next) }, { requestId });
}
