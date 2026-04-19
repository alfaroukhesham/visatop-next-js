import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { loadGuestApplicationRowByResumeCookie } from "@/lib/applications/guest-resume-access";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";
import { toPublicApplication } from "@/lib/applications/public-application";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withClientDbActor, withSystemDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchBody = z
  .object({
    guestEmail: z.string().email().max(320),
  })
  .strict();

async function loadApplicationForUser(
  userId: string,
  applicationId: string,
): Promise<typeof application.$inferSelect | null> {
  return withClientDbActor(userId, async (tx) => {
    const rows = await tx
      .select()
      .from(application)
      .where(eq(application.id, applicationId))
      .limit(1);
    return rows[0] ?? null;
  });
}

async function loadApplicationForGuest(
  applicationId: string,
  resumePlain: string,
): Promise<typeof application.$inferSelect | null> {
  return loadGuestApplicationRowByResumeCookie(applicationId, resumePlain);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id } = await ctx.params;
  const session = await auth.api.getSession({ headers: hdrs });

  if (session) {
    const row = await loadApplicationForUser(session.user.id, id);
    if (!row) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonOk({ application: toPublicApplication(row) }, { requestId });
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
  return jsonOk({ application: toPublicApplication(row) }, { requestId });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id } = await ctx.params;

  const parsed = await parseJsonBody(req, patchBody, requestId);
  if (!parsed.ok) return parsed.response;

  const session = await auth.api.getSession({ headers: hdrs });

  if (session) {
    const updated = await withClientDbActor(session.user.id, async (tx) => {
      return tx
        .update(application)
        .set({ guestEmail: parsed.data.guestEmail })
        .where(and(eq(application.id, id), eq(application.userId, session.user.id)))
        .returning();
    });
    const row = updated[0];
    if (!row) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonOk({ application: toPublicApplication(row) }, { requestId });
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
      .set({ guestEmail: parsed.data.guestEmail })
      .where(and(eq(application.id, id), eq(application.isGuest, true)))
      .returning();
  });
  const next = updated[0];
  if (!next) {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }
  return jsonOk({ application: toPublicApplication(next) }, { requestId });
}
