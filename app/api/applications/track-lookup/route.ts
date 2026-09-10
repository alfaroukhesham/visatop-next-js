import { headers } from "next/headers";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { decodeCursor, encodeCursor, parseLimit } from "@/lib/api/cursor";
import { jsonError, jsonOk } from "@/lib/api/response";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { applicationParty, nationality, visaService } from "@/lib/db/schema";
import { nationalityDisplayName } from "@/lib/apply/display-names";
import {
  findApplicationsForContactTrackLookupPaginated,
  isValidTrackContact,
  mapTrackLookupRow,
} from "@/lib/applications/track-lookup";
import { readCustomerLocaleFromCookieHeader } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

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
      "Enter a valid email address, a phone number with at least 8 digits, or a Tracking ID.",
      { status: 400, requestId },
    );
  }

  const limit = parseLimit(parsed.data.limit ? String(parsed.data.limit) : null, {
    defaultLimit: 5,
    max: 50,
  });
  const cursor = decodeCursor(parsed.data.cursor ?? null);
  const cookiePlain = readResumeTokenFromRequestCookies(req.headers.get("cookie"));

  const { items: rows, hasMore, services, nationalities, partyHashes } = await withSystemDbActor(async (tx) => {
    const result = await findApplicationsForContactTrackLookupPaginated(tx, contact, { limit, cursor });
    const serviceIds = [...new Set(result.items.map((r) => r.serviceId))];
    const nationalityCodes = [...new Set(result.items.map((r) => r.nationalityCode))];
    const partyIds = [...new Set(result.items.map((r) => r.partyId).filter(Boolean))] as string[];
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
    const partyHashes = partyIds.length
      ? await tx
          .select({ id: applicationParty.id, resumeTokenHash: applicationParty.resumeTokenHash })
          .from(applicationParty)
          .where(inArray(applicationParty.id, partyIds))
      : [];
    return { items: result.items, hasMore: result.hasMore, services, nationalities, partyHashes };
  });

  const partyHashById = new Map(partyHashes.map((p) => [p.id, p.resumeTokenHash]));
  const t = createCustomerT(readCustomerLocaleFromCookieHeader(hdrs.get("cookie")));

  const applications = rows.map((row) =>
    mapTrackLookupRow(
      row,
      {
        serviceName: services.find((s) => s.id === row.serviceId)?.name ?? null,
        nationalityName: nationalityDisplayName(row.nationalityCode, nationalities),
      },
      {
        cookiePlain,
        partyResumeTokenHash: row.partyId ? (partyHashById.get(row.partyId) ?? null) : null,
      },
      t,
    ),
  );

  const last = rows[rows.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  return jsonOk({ applications, nextCursor }, { requestId });
}
