import { headers } from "next/headers";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { computeClientApplicationTracking } from "@/lib/applications/user-facing-tracking";
import { findApplicationsForContactTrackLookup, isValidTrackContact } from "@/lib/applications/track-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contact: z.string().min(3).max(200),
});

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  const parsed = await parseJsonBody(req, bodySchema, requestId);
  if (!parsed.ok) return parsed.response;

  const { contact } = parsed.data;
  if (!isValidTrackContact(contact)) {
    return jsonError(
      "VALIDATION_ERROR",
      "Enter a valid email address, or a phone number with at least 8 digits.",
      { status: 400, requestId },
    );
  }

  const rows = await withSystemDbActor(async (tx) => {
    return findApplicationsForContactTrackLookup(tx, contact);
  });

  const applications = rows.map((row) => ({
    applicationId: row.id,
    referenceDisplay: row.referenceNumber ?? row.id.slice(0, 8),
    nationalityCode: row.nationalityCode,
    serviceId: row.serviceId,
    clientTracking: computeClientApplicationTracking({
      applicationStatus: row.applicationStatus,
      paymentStatus: row.paymentStatus,
      fulfillmentStatus: row.fulfillmentStatus,
      adminAttentionRequired: row.adminAttentionRequired,
    }),
  }));

  return jsonOk({ applications }, { requestId });
}
