import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminApplicationOpsPanel } from "@/components/admin/admin-application-ops-panel";
import { ApplicationActions } from "@/components/admin/application-actions";
import { ApplicationRefundForm } from "@/components/admin/application-refund-form";
import { formatMinorUnitsAmount } from "@/lib/pricing/format-minor-units";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  formatAuditActionTitle,
  formatAuditActionHint,
  formatAuditInlineDetails,
  type AdminApplicationAuditRow,
} from "@/lib/admin/application-audit-format";
import { ProfileRow, StatusBadge } from "@/components/admin/admin-application-detail-parts";

type ApplicationDetail = {
  id: string;
  referenceNumber: string | null;
  applicationStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  adminAttentionRequired: boolean | null;
  nationalityCode: string | null;
  isGuest: boolean;
  guestEmail: string | null;
  adminOpsStep: string | null;
  createdAt: Date;
  fullName: string | null;
  dateOfBirth: string | null;
  applicantNationality: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  placeOfBirth: string | null;
  profession: string | null;
  address: string | null;
  phone: string | null;
};

type PaymentRow = {
  id: string;
  provider: string;
  status: string;
  amount: bigint;
  currency: string;
  providerTransactionId: string | null;
  createdAt: Date;
};

type AdminDocumentRow = {
  id: string;
  documentType: string | null;
  status: string | null;
  createdAt: Date;
  originalFilename: string | null;
  byteLength: number | null;
};

export function AdminApplicationDetailView({
  app,
  serviceLabel,
  payments,
  shownAuditLogs,
  adminDocuments,
}: {
  app: ApplicationDetail;
  serviceLabel: string | null;
  payments: PaymentRow[];
  shownAuditLogs: AdminApplicationAuditRow[];
  adminDocuments: AdminDocumentRow[];
}) {
  return (
    <AdminShell
      title={app.referenceNumber ?? app.id.slice(0, 12) + "…"}
      subtitle={`Application ${app.id}`}
      active="applications"
    >
      <div className="space-y-8">
        <Link
          href="/admin/applications"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-none -ml-2")}
        >
          <ArrowLeft className="mr-1 size-4" />
          All applications
        </Link>

        {app.adminAttentionRequired && (
          <div className="border-2 border-destructive bg-destructive/5 p-4 flex items-center gap-3 animate-pulse">
            <AlertTriangle className="text-destructive size-6 shrink-0" />
            <div>
              <p className="font-bold text-destructive">Manual Intervention Required</p>
              <p className="text-sm text-destructive/80">
                This application was flagged by the system ,  check the audit log for details.
              </p>
            </div>
            <div className="ml-auto">
              <ApplicationActions applicationId={app.id} hasAttention={!!app.adminAttentionRequired} />
            </div>
          </div>
        )}

        <div className="border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div className="flex flex-wrap gap-6">
              <StatusBadge label="Application" value={app.applicationStatus} />
              <StatusBadge label="Payment" value={app.paymentStatus} />
              <StatusBadge label="Fulfillment" value={app.fulfillmentStatus} />
            </div>
            {!app.adminAttentionRequired && (
              <ApplicationActions applicationId={app.id} hasAttention={false} />
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 border-t border-border pt-4">
            <ProfileRow label="Nationality" value={app.nationalityCode} />
            <ProfileRow label="Service" value={serviceLabel ?? "Unknown service"} mono={false} />
            <ProfileRow label="Reference No." value={app.referenceNumber} />
            <ProfileRow label="Guest" value={app.isGuest ? "Yes" : "No"} />
            <ProfileRow label="Guest Email" value={app.guestEmail} />
            <ProfileRow label="Admin ops step" value={app.adminOpsStep} />
            <ProfileRow label="Created" value={app.createdAt.toLocaleString()} />
          </dl>
        </div>

        <div className="border border-border bg-card p-5 space-y-4">
          <h2 className="font-heading text-base font-semibold tracking-tight border-b-2 border-primary pb-0.5">
            Fulfillment & outcomes
          </h2>
          <AdminApplicationOpsPanel
            applicationId={app.id}
            paymentStatus={app.paymentStatus}
            applicationStatus={app.applicationStatus}
            documents={adminDocuments.map((d) => ({
              id: d.id,
              documentType: d.documentType,
              status: d.status,
              createdAt: d.createdAt.toISOString(),
              originalFilename: d.originalFilename,
              byteLength: d.byteLength,
            }))}
          />
        </div>

        <div className="border border-border bg-card p-5 space-y-4">
          <h2 className="font-heading text-base font-semibold tracking-tight border-b-2 border-primary pb-0.5">
            Applicant Profile
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <ProfileRow label="Full Name" value={app.fullName} />
            <ProfileRow label="Date of Birth" value={app.dateOfBirth} />
            <ProfileRow label="Nationality" value={app.applicantNationality} />
            <ProfileRow label="Passport Number" value={app.passportNumber} />
            <ProfileRow label="Passport Expiry" value={app.passportExpiryDate} />
            <ProfileRow label="Place of Birth" value={app.placeOfBirth} />
            <ProfileRow label="Profession" value={app.profession} />
            <ProfileRow label="Address" value={app.address} />
            <ProfileRow label="Phone" value={app.phone} />
          </dl>
        </div>

        <div className="border border-border bg-card p-5 space-y-4">
          <h2 className="font-heading text-base font-semibold tracking-tight border-b-2 border-primary pb-0.5">
            Payments
          </h2>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">No payment records.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground">Provider</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground">Status</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground">Amount</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground">Transaction ID</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2 font-medium capitalize">{p.provider}</td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5">{p.status}</span>
                      </td>
                      <td className="px-4 py-2 font-mono tabular-nums">
                        {formatMinorUnitsAmount(p.amount, p.currency)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                        {p.providerTransactionId ?? ", "}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {p.createdAt.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {app.paymentStatus === "paid" && (
            <div className="border-t border-border pt-4">
              <ApplicationRefundForm applicationId={app.id} />
            </div>
          )}
        </div>

        <div className="border border-border bg-card p-5 space-y-4">
          <h2 className="font-heading text-base font-semibold tracking-tight border-b-2 border-primary pb-0.5">
            Audit Log
          </h2>
          {shownAuditLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">No audit entries.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground">Action</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground">Actor</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground">Type</th>
                    <th className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shownAuditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className={cn("hover:bg-muted/40", log._derived ? "opacity-80" : "")}
                      title={log._derived ? "Derived from legacy records (not an audit_log row)" : undefined}
                    >
                      <td className="px-4 py-2 font-mono text-xs">
                        <div className="space-y-1">
                          <div className="font-sans text-xs font-semibold text-foreground">
                            {log._derived ? (
                              <span className="text-muted-foreground mr-2 font-mono">derived</span>
                            ) : null}
                            {formatAuditActionTitle(log.action)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            <span className="font-mono">{log.action}</span>
                          </div>
                          {formatAuditActionHint(log) ? (
                            <div className="text-[11px] text-muted-foreground">{formatAuditActionHint(log)}</div>
                          ) : null}
                          {formatAuditInlineDetails(log) ? (
                            <div className="text-[11px] text-muted-foreground">
                              {formatAuditInlineDetails(log)}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {log.actorId?.slice(0, 8) ?? ", "}
                      </td>
                      <td className="px-4 py-2 text-xs">{log.actorType}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {log.createdAt.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
