import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";
import { verifyResumeToken } from "@/lib/applications/resume-token";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withClientDbActor, withSystemDbActor } from "@/lib/db/actor-context";
import { application, applicationDocument } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId } = await ctx.params;
  const session = await auth.api.getSession({ headers: hdrs });

  if (session) {
    const rows = await withClientDbActor(session.user.id, async (tx) => {
      const own = await tx
        .select({ id: application.id })
        .from(application)
        .where(and(eq(application.id, applicationId), eq(application.userId, session.user.id)))
        .limit(1);
      if (!own.length) return null;
      return tx
        .update(applicationDocument)
        .set({ extractionStatus: "queued" })
        .where(
          and(
            eq(applicationDocument.applicationId, applicationId),
            eq(applicationDocument.extractionStatus, "pending"),
          ),
        )
        .returning({ id: applicationDocument.id });
    });
    if (rows === null) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonOk(
      { accepted: true, documentIds: rows.map((r) => r.id) },
      { status: 202, requestId },
    );
  }

  const cookieHeader = _req.headers.get("cookie");
  const token = readResumeTokenFromRequestCookies(cookieHeader);
  if (!token) {
    return jsonError("FORBIDDEN", "Missing resume session", { status: 403, requestId });
  }

  const rows = await withSystemDbActor(async (tx) => {
    const apps = await tx
      .select()
      .from(application)
      .where(eq(application.id, applicationId))
      .limit(1);
    const app = apps[0];
    if (!app?.resumeTokenHash || !verifyResumeToken(token, app.resumeTokenHash) || !app.isGuest) {
      return null;
    }
    return tx
      .update(applicationDocument)
      .set({ extractionStatus: "queued" })
      .where(
        and(
          eq(applicationDocument.applicationId, applicationId),
          eq(applicationDocument.extractionStatus, "pending"),
        ),
      )
      .returning({ id: applicationDocument.id });
  });
  if (rows === null) {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }
  return jsonOk(
    { accepted: true, documentIds: rows.map((r) => r.id) },
    { status: 202, requestId },
  );
}
