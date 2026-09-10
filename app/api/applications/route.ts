import { headers } from "next/headers";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { createDraftBodySchema, normalizeCreateDraftBody } from "@/lib/applications/create-draft-body";
import { createPartyDraft, CreatePartyDraftValidationError } from "@/lib/applications/create-party-draft";
import { toPublicApplication } from "@/lib/applications/public-application";
import { buildResumeSetCookieValue } from "@/lib/applications/resume-cookie";
import { generateResumeToken } from "@/lib/applications/resume-token";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { isForeignKeyViolation } from "@/lib/db/pg-errors";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { sendAdminStep2ServiceSelectedEmail } from "@/lib/email/send-admin-notification-emails";
import { sendApplicationDraftStartedEmail } from "@/lib/email/send-application-transactional-emails";
import { readCustomerLocaleFromCookieHeader } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

const queueAdminStep2Email = (applicationId: string, requestId: string | null) => {
  after(() => {
    void sendAdminStep2ServiceSelectedEmail(applicationId, requestId).catch((err) => {
      console.error("[api/applications] admin_step2_service_selected email failed", {
        applicationId,
        requestId,
        err: err instanceof Error ? err.message : err,
      });
    });
  });
};

const queueApplicationDraftStartedEmail = (input: {
  primaryApplicationId: string;
  partyId: string;
  guestEmail: string;
  requestId: string | null;
  locale: string;
}) => {
  after(() => {
    void sendApplicationDraftStartedEmail(input).catch((err) => {
      console.error("[api/applications] application_draft_started email failed", {
        primaryApplicationId: input.primaryApplicationId,
        partyId: input.partyId,
        requestId: input.requestId,
        err: err instanceof Error ? err.message : err,
      });
    });
  });
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const [session, parsed] = await Promise.all([
    auth.api.getSession({ headers: hdrs }),
    parseJsonBody(req, createDraftBodySchema, requestId),
  ]);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;
  const { travelers } = normalizeCreateDraftBody(body);
  const isGuest = !session;
  const userId = session?.user.id ?? null;
  const guestEmail = body.guestEmail?.trim() ? body.guestEmail.trim().toLowerCase() : null;

  const { plainToken, hash } = isGuest ? generateResumeToken() : { plainToken: null, hash: null };

  try {
    const result = await withSystemDbActor(async (tx) =>
      createPartyDraft(tx, {
        nationalityCode: body.nationalityCode,
        catalogCurrency: body.catalogCurrency,
        guestEmail,
        travelers,
        userId,
        isGuest,
        resumeTokenHash: hash,
      }),
    );

    const primaryRow = result.primaryRow;
    queueAdminStep2Email(result.primaryApplicationId, requestId);
    if (isGuest && guestEmail) {
      queueApplicationDraftStartedEmail({
        primaryApplicationId: result.primaryApplicationId,
        partyId: result.partyId,
        guestEmail,
        requestId,
        locale: readCustomerLocaleFromCookieHeader(hdrs.get("cookie")),
      });
    }

    const t = createCustomerT(readCustomerLocaleFromCookieHeader(hdrs.get("cookie")));
    const applicationJson = {
      ...toPublicApplication(primaryRow, undefined, t),
      isGuest,
    };

    if (isGuest) {
      const maxAge = result.ttlHours * 3600;
      const setCookie = buildResumeSetCookieValue(plainToken!, maxAge, {
        secure: process.env.NODE_ENV === "production",
      });
      return jsonOk(
        { application: applicationJson, partyId: result.partyId, memberIds: result.memberIds },
        {
          status: 201,
          requestId,
          headers: { "Set-Cookie": setCookie },
        },
      );
    }

    return jsonOk(
      { application: applicationJson, partyId: result.partyId, memberIds: result.memberIds },
      { status: 201, requestId },
    );
  } catch (e) {
    if (e instanceof CreatePartyDraftValidationError) {
      return jsonError("VALIDATION_ERROR", e.message, { status: 400, requestId });
    }
    if (isForeignKeyViolation(e)) {
      return jsonError("VALIDATION_ERROR", "Invalid nationality or service.", {
        status: 400,
        requestId,
      });
    }
    throw e;
  }
}
