import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { formatServiceTypeForExport } from "@/lib/applications/customer-export";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { loadApplicationTravellers } from "@/lib/admin/load-application-travellers";
import { AdminApplicationDetailView } from "@/components/admin/admin-application-detail-view";
import type { AdminApplicationAuditRow } from "@/lib/admin/application-audit-format";
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

  const { app, serviceLabel, payments, auditLogs, adminDocuments, travellers } =
    await withAdminDbActor(adminUserId, async ({ tx }) => {
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
        };
      }

      const serviceLabel = joined.serviceName
        ? formatServiceTypeForExport({
            name: joined.serviceName,
            durationDays: joined.serviceDurationDays,
            entries: joined.serviceEntries,
          })
        : null;

      const [payments, auditLogs, adminDocuments, travellers] = await Promise.all([
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
      ]);

      return { app, serviceLabel, payments, auditLogs, adminDocuments, travellers };
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

  return (
    <AdminApplicationDetailView
      app={app}
      serviceLabel={serviceLabel}
      payments={payments}
      shownAuditLogs={shownAuditLogs}
      adminDocuments={adminDocuments}
      travellers={travellers}
      selectedTravellerId={travellerParam ?? app.id}
    />
  );
}
