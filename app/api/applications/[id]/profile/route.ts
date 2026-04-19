import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withClientDbActor, withSystemDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema";
import { toPublicApplication } from "@/lib/applications/public-application";
import { resolveApplicationAccess } from "@/lib/applications/application-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const profilePatchBody = z
  .object({
    fullName: z.string().max(200).optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
      .optional(),
    placeOfBirth: z.string().max(500).optional(),
    applicantNationality: z.string().max(200).optional(),
    passportNumber: z.string().max(200).optional(),
    passportExpiryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
      .optional(),
    profession: z.string().max(500).optional(),
    address: z.string().max(500).optional(),
    phone: z.string().max(50).optional(),
    guestEmail: z.string().email().max(320).optional(),
  })
  .strict();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params;
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  const parsed = await parseJsonBody(req, profilePatchBody, requestId);
  if (!parsed.ok) return parsed.response;

  // Filter to only keys that were actually provided
  const updates = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );

  if (Object.keys(updates).length === 0) {
    return jsonError("VALIDATION_ERROR", "No fields to update", { status: 400, requestId });
  }

  const accessRes = await resolveApplicationAccess(req, hdrs, applicationId);
  if (!accessRes.ok) {
    const status = accessRes.failure.kind === "not_found" ? 404 : 403;
    return jsonError("UNAUTHORIZED", "Cannot access application", { status, requestId });
  }

  const doUpdate = async (tx: any) => {
    const updated = await tx
      .update(application)
      .set(updates)
      .where(eq(application.id, applicationId))
      .returning();
    const row = updated[0];
    if (!row) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonOk({ application: toPublicApplication(row) }, { requestId });
  };

  if (accessRes.access.kind === "user") {
    return await withClientDbActor(accessRes.access.userId, doUpdate);
  } else {
    return await withSystemDbActor(doUpdate);
  }
}
