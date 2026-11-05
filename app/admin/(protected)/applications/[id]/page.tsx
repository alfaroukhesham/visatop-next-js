import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { formatServiceTypeForExport } from "@/lib/applications/customer-export";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { loadApplicationTravellers } from "@/lib/admin/load-application-travellers";
import { AdminApplicationDetailView } from "@/components/admin/admin-application-detail-view";
import type { AdminApplicationAuditRow } from "@/lib/admin/application-audit-format";
import {
  isApplicantProfileStarted,
  resolveApplicationLastStep,
  type TLastStepDocument,
  type TLastStepTraveller,
} from "@/lib/applications/application-last-step";
import * as schema from "@/lib/db/schema";

export default async function AdminApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ traveller?: string | string[] }>;
}) {
  const [{ id: applicationId }, adminUserId, sp] = await Promise.all([
    params,
    getAdminUserId(),
    searchParams,
  ]);
  const travellerParam = Array.isArray(sp.traveller) ? sp.traveller[0] : sp.traveller;

  const {
    app,
    serviceLabel,
    payments,
    auditLogs,
    adminDocuments,
    travellers,
    partyRow,
    memberProfiles,
    funnelEvents,
    partyPayments,
  } = await withAdminDbActor(adminUserId, async ({ tx }) => {
      const [joined] = await tx
        .select({
          app: schema.application,
          serviceName: schema.visaService.name,
          serviceDurationDays: schema.visaService.durationDays,
          serviceEntries: schema.visaService.entries,
        })
        .from(schema.application)
        .leftJoin(schema.visaService, eq(schema.application.serviceId, schema.visaService.id))
        .where(eq(schema.application.id, applicationId))
        .limit(1);

      const app = joined?.app;
      if (!app) {
        return {
          app: null,
          serviceLabel: null,
          payments: [],
          auditLogs: [],
          adminDocuments: [],
          travellers: [],
          partyRow: null,
          memberProfiles: [],
          funnelEvents: [],
          partyPayments: [],
        };
      }

      const serviceLabel = joined.serviceName
        ? formatServiceTypeForExport({
            name: joined.serviceName,
            durationDays: joined.serviceDurationDays,
            entries: joined.serviceEntries,
          })
        : null;

      const [payments, auditLogs, adminDocuments, travellers, partyRow] = await Promise.all([
        tx
          .select()
          .from(schema.payment)
          .where(eq(schema.payment.applicationId, applicationId))
          .orderBy(desc(schema.payment.createdAt)),
        tx
          .select()
          .from(schema.auditLog)
          .where(eq(schema.auditLog.entityId, applicationId))
          .orderBy(desc(schema.auditLog.createdAt))
          .limit(30),
        tx
          .select({
            id: schema.applicationDocument.id,
            documentType: schema.applicationDocument.documentType,
            status: schema.applicationDocument.status,
            createdAt: schema.applicationDocument.createdAt,
            originalFilename: schema.applicationDocument.originalFilename,
            byteLength: schema.applicationDocument.byteLength,
          })
          .from(schema.applicationDocument)
          .where(eq(schema.applicationDocument.applicationId, applicationId))
          .orderBy(desc(schema.applicationDocument.createdAt))
          .limit(40),
        loadApplicationTravellers(tx, app),
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
      ]);

      const partyMemberIds = travellers.map((row) => row.applicationId);
      const eventAppIds = partyMemberIds.length > 0 ? partyMemberIds : [applicationId];
      const [memberProfiles, funnelEvents, partyPayments] = await Promise.all([
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
        partyMemberIds.length > 1
          ? tx
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
              .limit(1)
          : Promise.resolve([]),
      ]);

      return {
        app,
        serviceLabel,
        payments,
        auditLogs,
        adminDocuments,
        travellers,
        partyRow,
        memberProfiles,
        funnelEvents,
        partyPayments,
      };
    });

  if (!app) notFound();

  const derivedAuditLogs: AdminApplicationAuditRow[] = [
    {
      id: `legacy:${app.id}:created`,
      action: "legacy.application_created",
      actorType: "system",
      actorId: app.userId ?? null,
      createdAt: app.createdAt,
      _derived: true,
    },
    ...(app.paymentStatus === "paid"
      ? [
          {
            id: `legacy:${app.id}:paid`,
            action: "legacy.payment_paid",
            actorType: "system",
            actorId: app.userId ?? null,
            createdAt: payments[0]?.createdAt ?? app.updatedAt ?? app.createdAt,
            _derived: true,
          } satisfies AdminApplicationAuditRow,
        ]
      : []),
    ...(app.adminAttentionRequired
      ? [
          {
            id: `legacy:${app.id}:attention`,
            action: "legacy.admin_attention_required",
            actorType: "system",
            actorId: null,
            createdAt: app.updatedAt ?? app.createdAt,
            _derived: true,
          } satisfies AdminApplicationAuditRow,
        ]
      : []),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const shownAuditLogs: AdminApplicationAuditRow[] =
    auditLogs.length > 0 ? (auditLogs as AdminApplicationAuditRow[]) : derivedAuditLogs;

  const lastStepDocuments: TLastStepDocument[] =
    travellers.length > 0
      ? travellers.flatMap((traveller) =>
          traveller.documents.map((doc) => ({
            applicationId: traveller.applicationId,
            documentType: doc.documentType,
            status: doc.status,
            createdAt: doc.createdAt,
          })),
        )
      : adminDocuments.map((doc) => ({
          applicationId: app.id,
          documentType: doc.documentType,
          status: doc.status,
          createdAt: doc.createdAt,
        }));

  const lastStepTravellers: TLastStepTraveller[] = memberProfiles.map((member) => ({
    applicationId: member.id,
    travelerIndex: member.travelerIndex,
    profileStarted: isApplicantProfileStarted(member),
  }));
  const lastTravellerId =
    lastStepTravellers.toSorted((a, b) => a.travelerIndex - b.travelerIndex).at(-1)
      ?.applicationId ?? null;

  const latestPaymentRow = partyPayments[0] ?? payments[0] ?? null;
  const lastStep = resolveApplicationLastStep({
    applicationPaymentStatus: app.paymentStatus,
    applicationCreatedAt: app.createdAt,
    applicationUpdatedAt: app.updatedAt,
    applicationPaidAt: app.paidAt,
    latestPayment: latestPaymentRow
      ? {
          status: latestPaymentRow.status,
          failureCode: latestPaymentRow.failureCode,
          provider: latestPaymentRow.provider,
          createdAt: latestPaymentRow.createdAt,
          updatedAt: latestPaymentRow.updatedAt,
        }
      : null,
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
  });

  return (
    <AdminApplicationDetailView
      app={app}
      serviceLabel={serviceLabel}
      payments={payments}
      shownAuditLogs={shownAuditLogs}
      adminDocuments={adminDocuments}
      travellers={travellers}
      selectedTravellerId={travellerParam ?? app.id}
      lastStep={{
        fieldLabel: lastStep.fieldLabel,
        value: lastStep.displayValue,
        secondary: lastStep.whenDisplay,
      }}
    />
  );
}
