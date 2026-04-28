import { headers } from "next/headers";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { decodeCursor, encodeCursor, parseLimit } from "@/lib/api/cursor";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { computeClientApplicationTracking } from "@/lib/applications/user-facing-tracking";
import {
  findApplicationsForContactTrackLookupPaginated,
  isValidTrackContact,
} from "@/lib/applications/track-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contact: z.string().min(3).max(200),
  limit: z.number().int().min(1).max(50).optional(),
  cursor: z.string().nullable().optional(),
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

  const limit = parseLimit(parsed.data.limit ? String(parsed.data.limit) : null, {
    defaultLimit: 5,
    max: 50,
  });
  const cursor = decodeCursor(parsed.data.cursor ?? null);

  const { items: rows, hasMore } = await withSystemDbActor(async (tx) => {
    return findApplicationsForContactTrackLookupPaginated(tx, contact, { limit, cursor });
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

  const last = rows[rows.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  return jsonOk({ applications, nextCursor }, { requestId });
}
