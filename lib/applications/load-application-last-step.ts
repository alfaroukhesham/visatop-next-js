import { desc, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { loadApplicationTravellers } from "@/lib/admin/load-application-travellers";
import {
  isApplicantProfileStarted,
  resolveApplicationLastStep,
  toAdminLastStepView,
  type TAdminLastStepView,
  type TLastStepDocument,
  type TLastStepTraveller,
} from "@/lib/applications/application-last-step";
import * as schema from "@/lib/db/schema";

/**
 * Fresh last-step payload for the admin details card and its poll endpoint.
 * Read-only: no writes, no audit.
 */
export const loadApplicationLastStepView = async (
  tx: DbTransaction,
  applicationId: string,
  now: Date = new Date(),
): Promise<TAdminLastStepView | null> => {
  const [app] = await tx
    .select()
    .from(schema.application)
    .where(eq(schema.application.id, applicationId))
    .limit(1);
  if (!app) return null;

  const travellers = await loadApplicationTravellers(tx, app);
  const partyMemberIds = travellers.map((row) => row.applicationId);
  const eventAppIds = partyMemberIds.length > 0 ? partyMemberIds : [applicationId];

  const [payments, adminDocuments, partyRow, memberProfiles, funnelEvents] = await Promise.all([
    tx
      .select({
        status: schema.payment.status,
        failureCode: schema.payment.failureCode,
        provider: schema.payment.provider,
        createdAt: schema.payment.createdAt,
        updatedAt: schema.payment.updatedAt,
      })
      .from(schema.payment)
      .where(inArray(schema.payment.applicationId, eventAppIds))
      .orderBy(desc(schema.payment.createdAt))
      .limit(1),
    travellers.length > 0
      ? Promise.resolve(
          travellers.flatMap((traveller) =>
            traveller.documents.map((doc) => ({
              applicationId: traveller.applicationId,
              documentType: doc.documentType,
              status: doc.status,
              createdAt: doc.createdAt,
            })),
          ),
        )
      : tx
          .select({
            applicationId: schema.applicationDocument.applicationId,
            documentType: schema.applicationDocument.documentType,
            status: schema.applicationDocument.status,
            createdAt: schema.applicationDocument.createdAt,
          })
          .from(schema.applicationDocument)
          .where(eq(schema.applicationDocument.applicationId, applicationId))
          .orderBy(desc(schema.applicationDocument.createdAt))
          .limit(40),
    app.partyId
      ? tx
          .select({
            wizardCursorScreen: schema.applicationParty.wizardCursorScreen,
            wizardCursorTravellerId: schema.applicationParty.wizardCursorTravellerId,
            updatedAt: schema.applicationParty.updatedAt,
          })
          .from(schema.applicationParty)
          .where(eq(schema.applicationParty.id, app.partyId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    app.partyId
      ? tx
          .select({
            id: schema.application.id,
            travelerIndex: schema.application.travelerIndex,
            fullName: schema.application.fullName,
            dateOfBirth: schema.application.dateOfBirth,
            passportNumber: schema.application.passportNumber,
          })
          .from(schema.application)
          .where(eq(schema.application.partyId, app.partyId))
      : Promise.resolve([]),
    tx
      .select({
        eventName: schema.analyticsFunnelEvent.eventName,
        occurredAt: schema.analyticsFunnelEvent.occurredAt,
      })
      .from(schema.analyticsFunnelEvent)
      .where(inArray(schema.analyticsFunnelEvent.applicationId, eventAppIds)),
  ]);

  const lastStepDocuments: TLastStepDocument[] = adminDocuments;
  const lastStepTravellers: TLastStepTraveller[] = memberProfiles.map((member) => ({
    applicationId: member.id,
    travelerIndex: member.travelerIndex,
    profileStarted: isApplicantProfileStarted(member),
  }));
  const lastTravellerId =
    lastStepTravellers.toSorted((a, b) => a.travelerIndex - b.travelerIndex).at(-1)
      ?.applicationId ?? null;

  const latestPaymentRow = payments[0] ?? null;
  const step = resolveApplicationLastStep({
    applicationPaymentStatus: app.paymentStatus,
    applicationCreatedAt: app.createdAt,
    applicationUpdatedAt: app.updatedAt,
    applicationPaidAt: app.paidAt,
    latestPayment: latestPaymentRow,
    wizardCursor: partyRow
      ? {
          screen: partyRow.wizardCursorScreen,
          travellerId: partyRow.wizardCursorTravellerId,
        }
      : undefined,
    lastTravellerId,
    partyUpdatedAt: partyRow?.updatedAt ?? null,
    documents: lastStepDocuments,
    travellers: lastStepTravellers,
    events: funnelEvents,
    profileStarted: isApplicantProfileStarted(app),
    now,
  });
  return toAdminLastStepView(step);
};
