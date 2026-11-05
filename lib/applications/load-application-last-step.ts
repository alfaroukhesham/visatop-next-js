import { and, desc, eq, inArray, max } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import type { TAdminTraveller } from "@/lib/admin/load-application-travellers";
import type { ApplicationRow } from "@/lib/applications/load-application-row-for-request";
import {
  isApplicantProfileStarted,
  LAST_STEP_FUNNEL_EVENT_NAMES,
  resolveApplicationLastStep,
  toAdminLastStepView,
  type TAdminLastStepView,
  type TLastStepDocument,
  type TLastStepTraveller,
} from "@/lib/applications/application-last-step";
import * as schema from "@/lib/db/schema";

const lastStepDocumentColumns = {
  applicationId: schema.applicationDocument.applicationId,
  documentType: schema.applicationDocument.documentType,
  createdAt: schema.applicationDocument.createdAt,
  status: schema.applicationDocument.status,
};

export const lastStepDocumentsFromTravellers = (
  travellers: TAdminTraveller[],
): TLastStepDocument[] =>
  travellers.flatMap((traveller) =>
    traveller.documents.map((doc) => ({
      applicationId: traveller.applicationId,
      documentType: doc.documentType,
      status: doc.status,
      createdAt: doc.createdAt,
    })),
  );

/**
 * Fresh last-step payload for the admin details card and its poll endpoint.
 * Read-only: no writes, no audit.
 */
export const loadApplicationLastStepView = async (
  tx: DbTransaction,
  applicationId: string,
  options?: {
    now?: Date;
    app?: ApplicationRow;
    travellers?: TAdminTraveller[];
    documents?: TLastStepDocument[];
  },
): Promise<TAdminLastStepView | null> => {
  const now = options?.now ?? new Date();
  const app =
    options?.app ??
    (
      await tx
        .select()
        .from(schema.application)
        .where(eq(schema.application.id, applicationId))
        .limit(1)
    )[0];
  if (!app) return null;

  const memberProfiles = app.partyId
    ? await tx
        .select({
          id: schema.application.id,
          travelerIndex: schema.application.travelerIndex,
          fullName: schema.application.fullName,
          dateOfBirth: schema.application.dateOfBirth,
          passportNumber: schema.application.passportNumber,
        })
        .from(schema.application)
        .where(eq(schema.application.partyId, app.partyId))
    : [];

  const lastStepTravellers: TLastStepTraveller[] = memberProfiles.map((member) => ({
    applicationId: member.id,
    travelerIndex: member.travelerIndex,
    profileStarted: isApplicantProfileStarted(member),
  }));
  const lastTravellerId =
    lastStepTravellers.toSorted((a, b) => a.travelerIndex - b.travelerIndex).at(-1)
      ?.applicationId ?? null;
  const eventAppIds = lastStepTravellers.length > 0 ? lastStepTravellers.map((row) => row.applicationId) : [applicationId];
  const cursorDecidesStep = Boolean(app.partyId);

  const reusedDocuments =
    options?.documents ??
    (options?.travellers?.length ? lastStepDocumentsFromTravellers(options.travellers) : null);

  const [payments, adminDocuments, partyRow, lastEventRow, funnelEvents] = await Promise.all([
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
    reusedDocuments
      ? Promise.resolve(reusedDocuments)
      : tx
          .select(lastStepDocumentColumns)
          .from(schema.applicationDocument)
          .where(inArray(schema.applicationDocument.applicationId, eventAppIds))
          .orderBy(desc(schema.applicationDocument.createdAt)),
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
    tx
      .select({ occurredAt: max(schema.analyticsFunnelEvent.occurredAt) })
      .from(schema.analyticsFunnelEvent)
      .where(inArray(schema.analyticsFunnelEvent.applicationId, eventAppIds))
      .then((rows) => rows[0]?.occurredAt ?? null),
    cursorDecidesStep
      ? Promise.resolve([])
      : tx
          .select({
            eventName: schema.analyticsFunnelEvent.eventName,
            occurredAt: schema.analyticsFunnelEvent.occurredAt,
          })
          .from(schema.analyticsFunnelEvent)
          .where(
            and(
              inArray(schema.analyticsFunnelEvent.applicationId, eventAppIds),
              inArray(schema.analyticsFunnelEvent.eventName, [...LAST_STEP_FUNNEL_EVENT_NAMES]),
            ),
          ),
  ]);

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
    documents: adminDocuments,
    travellers: lastStepTravellers,
    events: funnelEvents,
    lastEventAt: lastEventRow,
    profileStarted: isApplicantProfileStarted(app),
    now,
  });
  return toAdminLastStepView(step);
};
