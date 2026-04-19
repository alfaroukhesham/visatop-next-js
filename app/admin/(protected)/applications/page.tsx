import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/admin-auth";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { listAdminApplications, getAttentionRequiredCount } from "@/lib/applications/admin-queries";
import { AdminShell } from "@/components/admin/admin-shell";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { AlertTriangle, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Applications | Admin",
};

export default async function AdminApplicationsPage(props: {
  searchParams: Promise<{ attention?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const hdrs = await headers();
  const session = await adminAuth.api.getSession({ headers: hdrs });

  if (!session) redirect("/admin/sign-in?callbackUrl=%2Fadmin%2Fapplications");

  const isAttentionView = searchParams.attention === "true";
  const page = Math.max(1, Number(searchParams.page || "1"));

  const { items, total, attentionCount } = await withAdminDbActor(
    session.user.id,
    async ({ tx }) => {
      const [{ items, total }, attentionCount] = await Promise.all([
        listAdminApplications(tx, {
          attention: isAttentionView,
          limit: 20,
          offset: (page - 1) * 20,
        }),
        getAttentionRequiredCount(tx),
      ]);
      return { items, total, attentionCount };
    }
  );

  return (
    <AdminShell
      title="Applications"
      subtitle="Review, manage, and monitor all visa applications across the platform."
      active="applications"
    >
      <div className="space-y-6">
        {/* Attention required banner */}
        {attentionCount > 0 && !isAttentionView && (
          <div className="border-2 border-destructive bg-destructive/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-destructive size-6 shrink-0" />
              <div>
                <p className="font-bold text-destructive">
                  {attentionCount} application{attentionCount !== 1 ? "s" : ""} need manual intervention
                </p>
                <p className="text-sm text-destructive/80">
                  Flagged by webhook handler — payment confirmed but requires human review.
                </p>
              </div>
            </div>
            <Link
              href="/admin/applications?attention=true"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-none border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0")}
            >
              Review flagged <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
        )}

        {/* Filter state */}
        {isAttentionView && (
          <div className="bg-muted px-4 py-2 flex items-center justify-between text-sm">
            <span className="font-medium flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Showing attention-required only
            </span>
            <Link href="/admin/applications" className="text-xs text-primary hover:underline">
              Clear filter
            </Link>
          </div>
        )}

        {/* Summary line */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground font-mono">
            {total} total application{total !== 1 ? "s" : ""}
            {isAttentionView ? " (filtered)" : ""}
          </p>
          {!isAttentionView && attentionCount > 0 && (
            <Link
              href="/admin/applications?attention=true"
              className="text-xs text-destructive hover:underline font-medium"
            >
              ⚠️ {attentionCount} flagged
            </Link>
          )}
        </div>

        {/* Table */}
        <div className="border border-border bg-card overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">Service</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">App Status</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">Payment</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">Flag</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground">Created</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((app) => (
                <tr
                  key={app.id}
                  className={cn(
                    "hover:bg-muted/40 transition-colors",
                    app.adminAttentionRequired ? "border-l-2 border-l-destructive" : ""
                  )}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {app.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{app.serviceId}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 font-mono">
                      {app.applicationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 text-xs font-mono",
                      app.paymentStatus === "paid"
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-muted text-muted-foreground border border-border"
                    )}>
                      {app.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {app.adminAttentionRequired ? (
                      <span className="text-destructive text-xs font-bold">⚠️ FLAG</span>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {app.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/applications/${app.id}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "rounded-none text-xs"
                      )}
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground italic">
                    No applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
