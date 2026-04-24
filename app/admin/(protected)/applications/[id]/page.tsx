import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { adminAuth } from "@/lib/admin-auth";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { AdminShell } from "@/components/admin/admin-shell";
import { ApplicationActions } from "@/components/admin/application-actions";
import { ApplicationRefundForm } from "@/components/admin/application-refund-form";
import * as schema from "@/lib/db/schema";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  action: string;
  actorId: string | null;
  actorType: string;
  createdAt: Date;
  _derived?: boolean;
  beforeJson?: string | null;
  afterJson?: string | null;
};

function tryParseJson(v: string | null | undefined): unknown {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function titleCaseFromSnake(v: string): string {
  return v
    .split("_")
    .filter(Boolean)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(" ");
}

function formatDocType(v: unknown): string {
  if (typeof v !== "string" || !v) return "unknown";
  // Common internal doc keys -> human labels
  switch (v) {
    case "passport_copy":
      return "Passport copy";
    case "personal_photo":
      return "Personal photo";
    default:
      return titleCaseFromSnake(v);
  }
}

function formatAuditActionTitle(action: string): string {
  switch (action) {
    case "payment_marked_paid":
      return "Payment confirmed (marked as paid)";
    case "payment_amount_mismatch_flagged":
      return "Payment amount mismatch (flagged for review)";
    case "payment_paid_docs_retain_failed_flagged":
      return "Post-payment document retention failed (flagged)";
    case "payment_paid_but_application_cancelled":
      return "Paid event received for a cancelled application (flagged)";
    case "payment_failed":
      return "Payment failed";
    case "guest_application_linked":
      return "Guest application linked to user account";
    case "application.attention.cleared":
      return "Admin cleared the attention flag";
    default:
      if (action.startsWith("application.transition.")) return "Application status changed";
      if (action.startsWith("application.profile.")) return "Applicant profile updated";
      if (action.startsWith("catalog.")) return "Catalog updated";
      if (action.startsWith("pricing.")) return "Pricing updated";
      if (action.startsWith("settings.")) return "Settings updated";
      return action;
  }
}

function formatAuditActionHint(log: AuditRow): string | null {
  switch (log.action) {
    case "payment_marked_paid":
      return "Webhook confirmed payment; app moved into processing.";
    case "payment_amount_mismatch_flagged":
      return "Paid, but the amount didn’t match what we expected. Check pricing + payment records.";
    case "payment_paid_docs_retain_failed_flagged":
      return "Paid, but required docs could not be retained. Check document storage + required docs.";
    case "payment_paid_but_application_cancelled":
      return "Paid webhook arrived after cancellation. Validate intent and decide next steps.";
    case "payment_failed":
      return "Paddle reported payment failure. Customer may need to retry checkout.";
    case "guest_application_linked":
      return "User account now owns this previously-guest application.";
    default:
      return null;
  }
}

function formatAuditInlineDetails(log: AuditRow): string | null {
  const after = tryParseJson(log.afterJson) as Record<string, unknown> | null;
  if (!after) return null;

  if (log.action === "payment_amount_mismatch_flagged") {
    const expected = after.expectedAmountMinor ?? after.paymentAmountMinor;
    const received = after.receivedAmountMinor ?? after.eventAmountMinor;
    if (typeof expected === "number" && typeof received === "number") {
      return `Expected ${expected} (minor units), received ${received}.`;
    }
  }

  if (log.action === "payment_paid_docs_retain_failed_flagged") {
    // Newer audit rows store `retention` payload from retainRequiredDocuments().
    const { retention } = after;
    if (retention && typeof retention === "object") {
      const r = retention as Record<string, unknown>;
      const { reason } = r;
      const missing = Array.isArray(r.missing) ? r.missing : null;

      if (reason === "MISSING_REQUIRED_DOCUMENT" && missing?.length) {
        return `Missing required: ${missing.map(formatDocType).join(", ")}.`;
      }
      if (reason === "BLOB_BYTES_MISSING" && missing?.length) {
        return `Uploaded, but bytes missing for: ${missing.map(formatDocType).join(", ")}.`;
      }
      if (typeof reason === "string" && reason) {
        return `Retention failed: ${titleCaseFromSnake(reason)}.`;
      }
    }

    // Backwards compat: older rows may have `error`.
    const err = after.error;
    if (typeof err === "string" && err) return `Error: ${err}`;
    if (err && typeof err === "object") return "Error: see details JSON";
  }

  if (log.action === "payment_marked_paid") {
    const { transactionId: txn, providerEventId } = after;
    if (typeof txn === "string" && txn) return `Transaction: ${txn}${typeof providerEventId === "string" ? ` · Event: ${providerEventId}` : ""}`;
  }

  return null;
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  const isGood = ["paid", "in_progress", "completed", "fulfilled", "retained"].includes(value);
  const isWarn = ["checkout_created", "refund_pending", "pending"].includes(value);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 text-xs font-bold font-mono rounded-none",
          isGood
            ? "bg-success/10 text-success border border-success/30"
            : isWarn
            ? "bg-warning/10 text-warning border border-warning/30"
            : "bg-muted text-muted-foreground border border-border"
        )}
      >
        {isGood ? (
          <CheckCircle2 className="size-3" />
        ) : isWarn ? (
          <Clock className="size-3" />
        ) : null}
        {value}
      </span>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-sm text-foreground">
        {value ?? <span className="text-muted-foreground/50 italic">—</span>}
      </dd>
    </div>
  );
}

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: applicationId } = await params;
  const hdrs = await headers();
  const session = await adminAuth.api.getSession({ headers: hdrs });

  if (!session) {
    redirect(`/admin/sign-in?callbackUrl=/admin/applications/${applicationId}`);
  }

  const { app, payments, auditLogs } = await withAdminDbActor(
    session.user.id,
    async ({ tx }) => {
      const rows = await tx
        .select()
        .from(schema.application)
        .where(eq(schema.application.id, applicationId))
        .limit(1);

      const app = rows[0];
      if (!app) return { app: null, payments: [], auditLogs: [] };

      const payments = await tx
        .select()
        .from(schema.payment)
        .where(eq(schema.payment.applicationId, applicationId))
        .orderBy(desc(schema.payment.createdAt));

      const auditLogs = await tx
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, applicationId))
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(30);

      return { app, payments, auditLogs };
    }
  );

  if (!app) notFound();

  const derivedAuditLogs: AuditRow[] = [
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
          } satisfies AuditRow,
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
          } satisfies AuditRow,
        ]
      : []),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const shownAuditLogs: AuditRow[] =
    auditLogs.length > 0 ? (auditLogs as unknown as AuditRow[]) : derivedAuditLogs;

  return (
    <AdminShell
      title={app.referenceNumber ?? app.id.slice(0, 12) + "…"}
      subtitle={`Application ${app.id}`}
      active="applications"
    >
      <div className="space-y-8">
        {/* Back link */}
        <Link
          href="/admin/applications"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-none -ml-2")}
        >
          <ArrowLeft className="mr-1 size-4" />
          All applications
        </Link>

        {/* Attention Banner */}
        {app.adminAttentionRequired && (
          <div className="border-2 border-destructive bg-destructive/5 p-4 flex items-center gap-3 animate-pulse">
            <AlertTriangle className="text-destructive size-6 shrink-0" />
            <div>
              <p className="font-bold text-destructive">Manual Intervention Required</p>
              <p className="text-sm text-destructive/80">
                This application was flagged by the system — check the audit log for details.
              </p>
            </div>
            <div className="ml-auto">
              <ApplicationActions
                applicationId={app.id}
                hasAttention={!!app.adminAttentionRequired}
              />
            </div>
          </div>
        )}

        {/* Status Row */}
        <div className="border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div className="flex flex-wrap gap-6">
              <StatusBadge label="Application" value={app.applicationStatus} />
              <StatusBadge label="Payment" value={app.paymentStatus} />
              <StatusBadge label="Fulfillment" value={app.fulfillmentStatus} />
            </div>
            {!app.adminAttentionRequired && (
              <ApplicationActions
                applicationId={app.id}
                hasAttention={false}
              />
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 border-t border-border pt-4">
            <ProfileRow label="Nationality" value={app.nationalityCode} />
            <ProfileRow label="Service ID" value={app.serviceId} />
            <ProfileRow label="Reference No." value={app.referenceNumber} />
            <ProfileRow label="Guest" value={app.isGuest ? "Yes" : "No"} />
            <ProfileRow label="Guest Email" value={app.guestEmail} />
            <ProfileRow label="Created" value={app.createdAt.toLocaleString()} />
          </dl>
        </div>

        {/* Applicant Profile */}
        <div className="border border-border bg-card p-5 space-y-4">
          <h2 className="font-heading text-base font-semibold tracking-tight border-l-4 border-primary pl-3">
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

        {/* Payments Section */}
        <div className="border border-border bg-card p-5 space-y-4">
          <h2 className="font-heading text-base font-semibold tracking-tight border-l-4 border-primary pl-3">
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
                      <td className="px-4 py-2 font-mono">
                        {p.amount ?? "—"} {p.currency ?? ""}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                        {p.providerTransactionId ?? "—"}
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

        {/* Audit Log */}
        <div className="border border-border bg-card p-5 space-y-4">
          <h2 className="font-heading text-base font-semibold tracking-tight border-l-4 border-primary pl-3">
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
                            <div className="text-[11px] text-muted-foreground">{formatAuditInlineDetails(log)}</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {log.actorId?.slice(0, 8) ?? "—"}
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
