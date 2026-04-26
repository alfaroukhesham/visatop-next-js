import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createDraftBodySchema } from "@/lib/applications/create-draft-body";
import { computeDraftExpiresAt, getDraftTtlHoursFromTx } from "@/lib/applications/draft-ttl";
import { toPublicApplication } from "@/lib/applications/public-application";
import { buildResumeSetCookieValue } from "@/lib/applications/resume-cookie";
import { generateResumeToken } from "@/lib/applications/resume-token";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { isForeignKeyViolation } from "@/lib/db/pg-errors";
import { withClientDbActor, withSystemDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const session = await auth.api.getSession({ headers: hdrs });

  const parsed = await parseJsonBody(req, createDraftBodySchema, requestId);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;
  const now = new Date();

  if (!session) {
    const ge = body.guestEmail?.trim();
    if (!ge) {
      return jsonError("VALIDATION_ERROR", "Guest email is required to create an application.", {
        status: 400,
        requestId,
      });
    }
  }

  if (session) {
    const userId = session.user.id;
    try {
      const row = await withClientDbActor(userId, async (tx) => {
        const ttlHours = await getDraftTtlHoursFromTx(tx);
        const draftExpiresAt = computeDraftExpiresAt(now, ttlHours);
        const inserted = await tx
          .insert(application)
          .values({
            userId,
            isGuest: false,
            guestEmail: body.guestEmail?.trim() ? body.guestEmail.trim().toLowerCase() : null,
            nationalityCode: body.nationalityCode,
            serviceId: body.serviceId,
            applicationStatus: "draft",
            paymentStatus: "unpaid",
            fulfillmentStatus: "not_started",
            draftExpiresAt,
            resumeTokenHash: null,
          })
          .returning();
        return inserted[0];
      });
      if (!row) {
        return jsonError("INTERNAL_ERROR", "Failed to create application", {
          status: 500,
          requestId,
        });
      }
      return jsonOk({ application: toPublicApplication(row) }, { status: 201, requestId });
    } catch (e) {
      if (isForeignKeyViolation(e)) {
        return jsonError("VALIDATION_ERROR", "Invalid nationality or service.", {
          status: 400,
          requestId,
        });
      }
      throw e;
    }
  }

  const { plainToken, hash } = generateResumeToken();
  try {
    const guest = await withSystemDbActor(async (tx) => {
      const ttlHours = await getDraftTtlHoursFromTx(tx);
      const draftExpiresAt = computeDraftExpiresAt(now, ttlHours);
      const maxAge = ttlHours * 3600;
        const inserted = await tx
          .insert(application)
          .values({
            userId: null,
            isGuest: true,
            guestEmail: body.guestEmail!.trim().toLowerCase(),
          nationalityCode: body.nationalityCode,
          serviceId: body.serviceId,
          applicationStatus: "draft",
          paymentStatus: "unpaid",
          fulfillmentStatus: "not_started",
          draftExpiresAt,
          resumeTokenHash: hash,
        })
        .returning();
      return { row: inserted[0], maxAge };
    });
    const { row, maxAge } = guest;
    if (!row) {
      return jsonError("INTERNAL_ERROR", "Failed to create application", {
        status: 500,
        requestId,
      });
    }
    const setCookie = buildResumeSetCookieValue(plainToken, maxAge, {
      secure: process.env.NODE_ENV === "production",
    });
    return jsonOk(
      { application: toPublicApplication(row) },
      {
        status: 201,
        requestId,
        headers: { "Set-Cookie": setCookie },
      },
    );
  } catch (e) {
    if (isForeignKeyViolation(e)) {
      return jsonError("VALIDATION_ERROR", "Invalid nationality or service.", {
        status: 400,
        requestId,
      });
    }
    throw e;
  }
}
