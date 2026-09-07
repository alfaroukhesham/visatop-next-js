import { asc, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, visaService } from "@/lib/db/schema";
import type { ApplicationRow } from "@/lib/applications/load-application-row-for-request";
import { loadMemberDocumentSlots } from "@/lib/applications/load-document-requirement-rows";
import {
  resolveDocumentRequirements,
  type TDocumentSlot,
} from "@/lib/apply/document-requirements";

export type TPublicPartyMember = {
  applicationId: string;
  travelerRole: "primary" | "additional";
  travelerKind: "adult" | "child";
  travelerIndex: number;
  serviceId: string;
  serviceName: string;
  slots: TDocumentSlot[];
};

export type TPublicPartyMemberBase = Omit<TPublicPartyMember, "slots">;

type TPartyRow = {
  applicationId: string;
  travelerRole: string;
  travelerKind: string;
  travelerIndex: number;
  serviceId: string;
  serviceName: string;
};

type TAppForMembers = {
  id: string;
  partyId: string | null;
  travelerRole: string;
  travelerKind: string;
  travelerIndex: number;
  serviceId: string;
};

/**
 * Pure mapping of the app + its party rows into public members. Legacy (null
 * `partyId`) returns just the app; otherwise all party rows ordered by
 * `travelerIndex`. Kept pure so tests need no DB.
 */
export function buildPublicPartyMembers(
  app: TAppForMembers,
  appServiceName: string,
  partyRows: TPartyRow[],
): TPublicPartyMemberBase[] {
  if (!app.partyId) {
    return [
      {
        applicationId: app.id,
        travelerRole: app.travelerRole as TPublicPartyMember["travelerRole"],
        travelerKind: app.travelerKind as TPublicPartyMember["travelerKind"],
        travelerIndex: app.travelerIndex,
        serviceId: app.serviceId,
        serviceName: appServiceName,
      },
    ];
  }
  return [...partyRows]
    .sort((a, b) => a.travelerIndex - b.travelerIndex)
    .map((r) => ({
      applicationId: r.applicationId,
      travelerRole: r.travelerRole as TPublicPartyMember["travelerRole"],
      travelerKind: r.travelerKind as TPublicPartyMember["travelerKind"],
      travelerIndex: r.travelerIndex,
      serviceId: r.serviceId,
      serviceName: r.serviceName,
    }));
}

export const attachMemberDocumentSlots = (
  members: TPublicPartyMemberBase[],
  slotsByApplicationId: Record<string, TDocumentSlot[]>,
): TPublicPartyMember[] =>
  members.map((m) => ({
    ...m,
    slots: slotsByApplicationId[m.applicationId] ?? resolveDocumentRequirements([]),
  }));

export const slotsForPartyMember = (
  members: TPublicPartyMember[],
  memberId: string,
): TDocumentSlot[] =>
  members.find((m) => m.applicationId === memberId)?.slots ?? resolveDocumentRequirements([]);

/**
 * Load the party members for an application. If the application belongs to a
 * party, returns every member (ordered by `travelerIndex`) with its service
 * name; otherwise returns just the application (legacy single-traveller).
 */
export async function loadPartyMembers(
  tx: DbTransaction,
  app: ApplicationRow,
): Promise<TPublicPartyMember[]> {
  const [service] = await tx
    .select({ name: visaService.name })
    .from(visaService)
    .where(eq(visaService.id, app.serviceId))
    .limit(1);
  const appServiceName = service?.name ?? "";

  const partyRows = app.partyId
    ? await tx
        .select({
          applicationId: application.id,
          travelerRole: application.travelerRole,
          travelerKind: application.travelerKind,
          travelerIndex: application.travelerIndex,
          serviceId: application.serviceId,
          serviceName: visaService.name,
        })
        .from(application)
        .innerJoin(visaService, eq(visaService.id, application.serviceId))
        .where(eq(application.partyId, app.partyId))
        .orderBy(asc(application.travelerIndex))
    : [];

  const baseMembers = buildPublicPartyMembers(app, appServiceName, partyRows);
  const slotsByApplicationId: Record<string, TDocumentSlot[]> = {};
  await Promise.all(
    baseMembers.map(async (m) => {
      slotsByApplicationId[m.applicationId] = await loadMemberDocumentSlots(tx, {
        serviceId: m.serviceId,
        nationalityCode: app.nationalityCode,
      });
    }),
  );
  return attachMemberDocumentSlots(baseMembers, slotsByApplicationId);
}
