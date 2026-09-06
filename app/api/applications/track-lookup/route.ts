import { headers } from "next/headers";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { decodeCursor, encodeCursor, parseLimit } from "@/lib/api/cursor";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { nationality, visaService } from "@/lib/db/schema";
import { nationalityDisplayName } from "@/lib/apply/display-names";
import {
  findApplicationsForContactTrackLookupPaginated,
  isValidTrackContact,
  mapTrackLookupRow,
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

  const { items: rows, hasMore, services, nationalities } = await withSystemDbActor(async (tx) => {
    const result = await findApplicationsForContactTrackLookupPaginated(tx, contact, { limit, cursor });
    const serviceIds = [...new Set(result.items.map((r) => r.serviceId))];
    const nationalityCodes = [...new Set(result.items.map((r) => r.nationalityCode))];
    const services = serviceIds.length
      ? await tx
          .select({ id: visaService.id, name: visaService.name })
          .from(visaService)
          .where(inArray(visaService.id, serviceIds))
      : [];
    const nationalities = nationalityCodes.length
      ? await tx
          .select({ code: nationality.code, name: nationality.name })
          .from(nationality)
          .where(inArray(nationality.code, nationalityCodes))
      : [];
    return { items: result.items, hasMore: result.hasMore, services, nationalities };
  });

  const applications = rows.map((row) =>
    mapTrackLookupRow(row, {
      serviceName: services.find((s) => s.id === row.serviceId)?.name ?? null,
      nationalityName: nationalityDisplayName(row.nationalityCode, nationalities),
    }),
  );

  const last = rows[rows.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  return jsonOk({ applications, nextCursor }, { requestId });
}
