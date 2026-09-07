import { eq } from "drizzle-orm";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";
import { hashResumeToken } from "@/lib/applications/resume-token";
import type { DbTransaction } from "@/lib/db";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application, applicationParty, nationality, visaService } from "@/lib/db/schema";

export type TResumeHint = {
  primaryApplicationId: string;
  partyId: string | null;
  travelerCount: number;
  nationalityName: string;
  serviceName: string;
  href: string;
};

export type TBuildResumeHintInput = {
  primaryApplicationId: string;
  partyId: string | null;
  paymentStatus: string;
  draftExpiresAt: Date | null;
  nationalityName: string;
  serviceName: string;
  travelerCount: number;
};

const RESUMABLE_PAYMENT_STATUSES = new Set(["unpaid", "checkout_created"]);

export const buildResumeHint = (
  input: TBuildResumeHintInput,
  now: Date,
): TResumeHint | null => {
  if (input.draftExpiresAt && input.draftExpiresAt < now) {
    return null;
  }
  if (!RESUMABLE_PAYMENT_STATUSES.has(input.paymentStatus)) {
    return null;
  }
  return {
    primaryApplicationId: input.primaryApplicationId,
    partyId: input.partyId,
    travelerCount: input.travelerCount,
    nationalityName: input.nationalityName,
    serviceName: input.serviceName,
    href: `/apply/applications/${input.primaryApplicationId}`,
  };
};

type TResumeHintSource = {
  primaryApplicationId: string;
  partyId: string | null;
  paymentStatus: string;
  draftExpiresAt: Date | null;
  nationalityCode: string;
  primaryServiceId: string;
  travelerCount: number;
};

const resolvePrimaryMember = (
  members: { id: string; travelerRole: string; serviceId: string }[],
): { id: string; serviceId: string } | null => {
  if (members.length === 0) return null;
  const primary = members.find((m) => m.travelerRole === "primary");
  return primary ?? members[0] ?? null;
};

const resolveResumeHintSource = async (
  tx: DbTransaction,
  hash: string,
): Promise<TResumeHintSource | null> => {
  const [party] = await tx
    .select()
    .from(applicationParty)
    .where(eq(applicationParty.resumeTokenHash, hash))
    .limit(1);

  if (party) {
    const members = await tx
      .select({
        id: application.id,
        travelerRole: application.travelerRole,
        serviceId: application.serviceId,
      })
      .from(application)
      .where(eq(application.partyId, party.id));
    const primary = resolvePrimaryMember(members);
    if (!primary) return null;
    return {
      primaryApplicationId: primary.id,
      partyId: party.id,
      paymentStatus: party.paymentStatus,
      draftExpiresAt: party.draftExpiresAt,
      nationalityCode: party.nationalityCode,
      primaryServiceId: primary.serviceId,
      travelerCount: members.length > 0 ? members.length : 1,
    };
  }

  const [app] = await tx
    .select()
    .from(application)
    .where(eq(application.resumeTokenHash, hash))
    .limit(1);
  if (!app) return null;

  if (app.partyId) {
    const [linkedParty] = await tx
      .select()
      .from(applicationParty)
      .where(eq(applicationParty.id, app.partyId))
      .limit(1);
    const members = await tx
      .select({
        id: application.id,
        travelerRole: application.travelerRole,
        serviceId: application.serviceId,
      })
      .from(application)
      .where(eq(application.partyId, app.partyId));
    const primary = resolvePrimaryMember(members);
    if (!primary) return null;
    return {
      primaryApplicationId: primary.id,
      partyId: app.partyId,
      paymentStatus: linkedParty?.paymentStatus ?? app.paymentStatus,
      draftExpiresAt: linkedParty?.draftExpiresAt ?? app.draftExpiresAt,
      nationalityCode: linkedParty?.nationalityCode ?? app.nationalityCode,
      primaryServiceId: primary.serviceId,
      travelerCount: members.length > 0 ? members.length : 1,
    };
  }

  return {
    primaryApplicationId: app.id,
    partyId: null,
    paymentStatus: app.paymentStatus,
    draftExpiresAt: app.draftExpiresAt,
    nationalityCode: app.nationalityCode,
    primaryServiceId: app.serviceId,
    travelerCount: 1,
  };
};

export const loadResumeHintFromCookieHeader = async (
  cookieHeader: string | null,
): Promise<TResumeHint | null> => {
  const plain = readResumeTokenFromRequestCookies(cookieHeader);
  if (!plain) return null;

  const hash = hashResumeToken(plain);
  const now = new Date();

  return withSystemDbActor(async (tx) => {
    const source = await resolveResumeHintSource(tx, hash);
    if (!source) return null;

    const [[nat], [svc]] = await Promise.all([
      tx
        .select({ name: nationality.name })
        .from(nationality)
        .where(eq(nationality.code, source.nationalityCode))
        .limit(1),
      tx
        .select({ name: visaService.name })
        .from(visaService)
        .where(eq(visaService.id, source.primaryServiceId))
        .limit(1),
    ]);

    return buildResumeHint(
      {
        primaryApplicationId: source.primaryApplicationId,
        partyId: source.partyId,
        paymentStatus: source.paymentStatus,
        draftExpiresAt: source.draftExpiresAt,
        nationalityName: nat?.name ?? source.nationalityCode,
        serviceName: svc?.name ?? "",
        travelerCount: source.travelerCount,
      },
      now,
    );
  });
};
