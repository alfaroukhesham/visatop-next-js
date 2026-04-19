/**
 * Client-facing document collection endpoint for an application.
 *
 * - `GET` — returns a lightweight list of non-deleted documents so the apply
 *   wizard can gate "both uploads exist" without relying on localStorage.
 * - `POST` (legacy JSON body) — deprecated Phase-2 metadata-only stub. Kept
 *   temporarily so the existing draft panel keeps compiling; new multipart
 *   uploads go through `POST /api/applications/[id]/documents/upload`.
 */
import { headers } from "next/headers";
import { and, desc, eq, ne, or, isNull } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { toPublicDocument } from "@/lib/applications/document-upload";
import { verifyResumeToken } from "@/lib/applications/resume-token";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { isForeignKeyViolation } from "@/lib/db/pg-errors";
import { withClientDbActor, withSystemDbActor } from "@/lib/db/actor-context";
import {
  application,
  applicationDocument,
  DOCUMENT_STATUS,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const docBody = z.object({
  storageKey: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId } = await ctx.params;

  const access = await resolveApplicationAccess(req, hdrs, applicationId);
  if (!access.ok) {
    if (access.failure.kind === "not_found") {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonError("FORBIDDEN", "Missing resume session", { status: 403, requestId });
  }

  const listFn = async (tx: Parameters<Parameters<typeof withSystemDbActor>[0]>[0]) =>
    tx
      .select()
      .from(applicationDocument)
      .where(
        and(
          eq(applicationDocument.applicationId, applicationId),
          or(
            ne(applicationDocument.status, DOCUMENT_STATUS.DELETED),
            isNull(applicationDocument.status),
          ),
        ),
      )
      .orderBy(desc(applicationDocument.createdAt));

  const rows =
    access.access.kind === "user"
      ? await withClientDbActor(access.access.userId, listFn)
      : await withSystemDbActor(listFn);

  return jsonOk({ documents: rows.map(toPublicDocument) }, { requestId });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId } = await ctx.params;

  const parsed = await parseJsonBody(req, docBody, requestId);
  if (!parsed.ok) return parsed.response;

  const session = await auth.api.getSession({ headers: hdrs });

  try {
    if (session) {
      const row = await withClientDbActor(session.user.id, async (tx) => {
        const inserted = await tx
          .insert(applicationDocument)
          .values({
            applicationId,
            storageKey: parsed.data.storageKey,
            mimeType: parsed.data.mimeType,
            sizeBytes: parsed.data.sizeBytes,
          })
          .returning();
        return inserted[0];
      });
      if (!row) {
        return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
      }
      return jsonOk({ document: row }, { status: 201, requestId });
    }

    const token = readResumeTokenFromRequestCookies(req.headers.get("cookie"));
    if (!token) {
      return jsonError("FORBIDDEN", "Missing resume session", { status: 403, requestId });
    }
    const row = await withSystemDbActor(async (tx) => {
      const apps = await tx
        .select()
        .from(application)
        .where(eq(application.id, applicationId))
        .limit(1);
      const app = apps[0];
      if (!app?.resumeTokenHash || !verifyResumeToken(token, app.resumeTokenHash) || !app.isGuest) {
        return null;
      }
      const inserted = await tx
        .insert(applicationDocument)
        .values({
          applicationId,
          storageKey: parsed.data.storageKey,
          mimeType: parsed.data.mimeType,
          sizeBytes: parsed.data.sizeBytes,
        })
        .returning();
      return inserted[0];
    });
    if (!row) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonOk({ document: row }, { status: 201, requestId });
  } catch (e) {
    if (isForeignKeyViolation(e)) {
      return jsonError("VALIDATION_ERROR", "Invalid application.", { status: 400, requestId });
    }
    throw e;
  }
}
