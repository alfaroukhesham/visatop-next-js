import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { loadGuestApplicationByResumeCookie } from "@/lib/applications/guest-resume-access";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { loadPartyMembers } from "@/lib/applications/load-party-members";
import {
  buildResumeCookieHeaders,
  readResumeTokensFromRequestCookies,
} from "@/lib/applications/resume-cookie";
import { toPublicApplication } from "@/lib/applications/public-application";
import { toPublicApplicationWithCharge } from "@/lib/applications/load-application-charge";
import { readCustomerLocaleFromCookieHeader } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withClientDbActor, withSystemDbActor } from "@/lib/db/actor-context";
import { application, applicationParty } from "@/lib/db/schema";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { serverFunnelEventId } from "@/lib/analytics/funnel-event-names";
import { recordFunnelEvent } from "@/lib/analytics/record-funnel-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchBody = z.strictObject({
  guestEmail: z.email().max(320),
});

const loadApplicationForGuest = async (
  applicationId: string,
  resumePlain: string | readonly string[],
): Promise<typeof application.$inferSelect | null> => {
  const loaded = await loadGuestApplicationByResumeCookie(applicationId, resumePlain);
  return loaded?.row ?? null;
};

async function applicationWithMembers(
  row: typeof application.$inferSelect,
  t: (key: string) => string,
) {
  const [publicApp, members, wizardCursor] = await Promise.all([
    toPublicApplicationWithCharge(row, t),
    withSystemDbActor((tx) => loadPartyMembers(tx, row)),
    row.partyId
      ? withSystemDbActor(async (tx) => {
          const [party] = await tx
            .select({
              screen: applicationParty.wizardCursorScreen,
              travellerId: applicationParty.wizardCursorTravellerId,
            })
            .from(applicationParty)
            .where(eq(applicationParty.id, row.partyId!))
            .limit(1);
          if (
            party?.screen !== "ready" &&
            party?.screen !== "passport" &&
            party?.screen !== "other" &&
            party?.screen !== "details"
          ) {
            return null;
          }
          return { screen: party.screen, travellerId: party.travellerId };
        })
      : Promise.resolve(null),
  ]);
  return { application: publicApp, members, wizardCursor };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const t = createCustomerT(readCustomerLocaleFromCookieHeader(hdrs.get("cookie")));
  const [{ id }, session] = await Promise.all([
    ctx.params,
    auth.api.getSession({ headers: hdrs }),
  ]);

  if (session) {
    const row = await loadApplicationRowForRequest(id, req.headers.get("cookie"));
    if (!row) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonOk(await applicationWithMembers(row, t), { requestId });
  }

  const cookieHeader = req.headers.get("cookie");
  const tokens = readResumeTokensFromRequestCookies(cookieHeader);
  if (tokens.length === 0) {
    // Guest without cookie: 403 (distinct from 404) so clients can distinguish
    // “no possession proof” from unknown id. RSC `/submitted` uses unified 404.
    return jsonError("FORBIDDEN", "Missing resume session", { status: 403, requestId });
  }
  const loaded = await loadGuestApplicationByResumeCookie(id, tokens);
  if (!loaded) {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }
  const maxAge = loaded.row.draftExpiresAt
    ? Math.max(0, Math.floor((loaded.row.draftExpiresAt.getTime() - Date.now()) / 1000))
    : 0;
  const headersOut =
    maxAge > 0
      ? buildResumeCookieHeaders(loaded.resumePlain, maxAge, {
          secure: process.env.NODE_ENV === "production",
        })
      : undefined;
  return jsonOk(await applicationWithMembers(loaded.row, t), { requestId, headers: headersOut });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const t = createCustomerT(readCustomerLocaleFromCookieHeader(hdrs.get("cookie")));
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
        const rows = await tx
          .update(application)
          .set({ guestEmail: nextEmail })
          .where(and(eq(application.id, id), eq(application.userId, session.user.id)))
          .returning();
        const row = rows[0];
        if (row) {
          await recordFunnelEvent(tx, {
            eventId: serverFunnelEventId(row.id, APPLY_FUNNEL_EVENTS.applicationLinkSaved),
            eventName: APPLY_FUNNEL_EVENTS.applicationLinkSaved,
            sessionId: `server:${row.id}`,
            applicationId: row.id,
            nationalityCode: row.nationalityCode,
            serviceId: row.serviceId,
            source: "server",
          });
        }
        return rows;
      });
      const row = updated[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
      }
      return jsonOk({ application: toPublicApplication(row, undefined, t) }, { requestId });
    }

    if (existing.userId == null) {
      const updated = await withSystemDbActor(async (tx) => {
        const rows = await tx
          .update(application)
          .set({ guestEmail: nextEmail })
          .where(and(eq(application.id, id), isNull(application.userId)))
          .returning();
        const row = rows[0];
        if (row) {
          await recordFunnelEvent(tx, {
            eventId: serverFunnelEventId(row.id, APPLY_FUNNEL_EVENTS.applicationLinkSaved),
            eventName: APPLY_FUNNEL_EVENTS.applicationLinkSaved,
            sessionId: `server:${row.id}`,
            applicationId: row.id,
            nationalityCode: row.nationalityCode,
            serviceId: row.serviceId,
            source: "server",
          });
        }
        return rows;
      });
      const row = updated[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
      }
      return jsonOk({ application: toPublicApplication(row, undefined, t) }, { requestId });
    }

    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }

  const cookieHeader = req.headers.get("cookie");
  const tokens = readResumeTokensFromRequestCookies(cookieHeader);
  if (tokens.length === 0) {
    return jsonError("FORBIDDEN", "Missing resume session", { status: 403, requestId });
  }
  const row = await loadApplicationForGuest(id, tokens);
  if (!row) {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }
  const updated = await withSystemDbActor(async (tx) => {
    const rows = await tx
      .update(application)
      .set({ guestEmail: parsed.data.guestEmail.trim().toLowerCase() })
      .where(and(eq(application.id, id), eq(application.isGuest, true)))
      .returning();
    const row = rows[0];
    if (row) {
      await recordFunnelEvent(tx, {
        eventId: serverFunnelEventId(row.id, APPLY_FUNNEL_EVENTS.applicationLinkSaved),
        eventName: APPLY_FUNNEL_EVENTS.applicationLinkSaved,
        sessionId: `server:${row.id}`,
        applicationId: row.id,
        nationalityCode: row.nationalityCode,
        serviceId: row.serviceId,
        source: "server",
      });
    }
    return rows;
  });
  const next = updated[0];
  if (!next) {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }
  return jsonOk({ application: toPublicApplication(next, undefined, t) }, { requestId });
}
