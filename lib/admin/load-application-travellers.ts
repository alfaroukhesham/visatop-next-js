import { asc, desc, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, applicationDocument, visaService } from "@/lib/db/schema";
import type { ApplicationRow } from "@/lib/applications/load-application-row-for-request";

export type TAdminTraveller = {
  applicationId: string;
  travelerRole: "primary" | "additional";
  travelerKind: "adult" | "child";
  travelerIndex: number;
  serviceName: string;
  applicationStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  documents: Array<{
    id: string;
    documentType: string | null;
    status: string | null;
    createdAt: Date;
    originalFilename: string | null;
    byteLength: number | null;
  }>;
};

type TMemberRow = {
  applicationId: string;
  travelerRole: string;
  travelerKind: string;
  travelerIndex: number;
  serviceName: string;
  applicationStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
};

type TDocRow = {
  applicationId: string;
  id: string;
  documentType: string | null;
  status: string | null;
  createdAt: Date;
  originalFilename: string | null;
  byteLength: number | null;
};

type TAppForTravellers = {
  partyId: string | null;
};

/**
 * Pure mapping of party member rows + their documents into admin travellers.
 * Legacy (null `partyId`) returns `[]` so the admin card is omitted. Kept pure
 * so tests need no DB.
 */
export function buildAdminTravellers(
  app: TAppForTravellers,
  memberRows: TMemberRow[],
  docRows: TDocRow[],
): TAdminTraveller[] {
  if (!app.partyId) return [];

  const docsByApp = new Map<string, TAdminTraveller["documents"]>();
  for (const d of docRows) {
    const list = docsByApp.get(d.applicationId) ?? [];
    list.push({
      id: d.id,
      documentType: d.documentType,
      status: d.status,
      createdAt: d.createdAt,
      originalFilename: d.originalFilename,
      byteLength: d.byteLength,
    });
    docsByApp.set(d.applicationId, list);
  }

  return [...memberRows]
    .sort((a, b) => a.travelerIndex - b.travelerIndex)
    .map((r) => ({
      applicationId: r.applicationId,
      travelerRole: r.travelerRole as TAdminTraveller["travelerRole"],
      travelerKind: r.travelerKind as TAdminTraveller["travelerKind"],
      travelerIndex: r.travelerIndex,
      serviceName: r.serviceName,
      applicationStatus: r.applicationStatus,
      paymentStatus: r.paymentStatus,
      fulfillmentStatus: r.fulfillmentStatus,
      documents: docsByApp.get(r.applicationId) ?? [],
    }));
}

/**
 * Load every traveller on an application's party (ordered by `travelerIndex`)
 * with its statuses and documents. Legacy (null `partyId`) returns `[]`.
 */
export async function loadApplicationTravellers(
  tx: DbTransaction,
  app: ApplicationRow,
): Promise<TAdminTraveller[]> {
  if (!app.partyId) return [];

  const memberRows = await tx
    .select({
      applicationId: application.id,
      travelerRole: application.travelerRole,
      travelerKind: application.travelerKind,
      travelerIndex: application.travelerIndex,
      serviceName: visaService.name,
      applicationStatus: application.applicationStatus,
      paymentStatus: application.paymentStatus,
      fulfillmentStatus: application.fulfillmentStatus,
    })
    .from(application)
    .innerJoin(visaService, eq(visaService.id, application.serviceId))
    .where(eq(application.partyId, app.partyId))
    .orderBy(asc(application.travelerIndex));

  const ids = memberRows.map((r) => r.applicationId);
  const docRows = ids.length
    ? await tx
        .select({
          applicationId: applicationDocument.applicationId,
          id: applicationDocument.id,
          documentType: applicationDocument.documentType,
          status: applicationDocument.status,
          createdAt: applicationDocument.createdAt,
          originalFilename: applicationDocument.originalFilename,
          byteLength: applicationDocument.byteLength,
        })
        .from(applicationDocument)
        .where(inArray(applicationDocument.applicationId, ids))
        .orderBy(desc(applicationDocument.createdAt))
    : [];

  return buildAdminTravellers(app, memberRows, docRows);
}
