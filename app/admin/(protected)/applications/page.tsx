import { headers } from "next/headers";
import { adminAuth } from "@/lib/admin-auth";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { getAttentionRequiredCount, listAdminApplications } from "@/lib/applications/admin-queries";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Applications | Admin",
};

export default async function AdminApplicationsPage(props: {
  searchParams: Promise<{ attention?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const hdrs = await headers();
  const session = await adminAuth.api.getSession({ headers: hdrs });

  if (!session) {
    // This should be handled by middleware/layout, but for safety:
    return <div>Unauthorized</div>;
  }

  const isAttentionView = searchParams.attention === "true";

  const { items, total, attentionCount } = await withAdminDbActor(
    session.user.id,
    async ({ tx }) => {
      const [{ items, total }, attentionCount] = await Promise.all([
        listAdminApplications(tx, {
          attention: isAttentionView,
          limit: 20,
          offset: (Number(searchParams.page || "1") - 1) * 20,
        }),
        getAttentionRequiredCount(tx),
      ]);
      return { items, total, attentionCount };
    }
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
        <div className="text-sm text-muted-foreground font-mono">
          Total: {total}
        </div>
      </div>

      {attentionCount > 0 && !isAttentionView && (
        <div className="bg-destructive/10 border-2 border-destructive p-4 flex justify-between items-center animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-destructive size-6" />
            <div>
              <p className="text-destructive font-bold">
                Attention Required
              </p>
              <p className="text-sm text-destructive/80">
                {attentionCount} application(s) flagged for manual intervention (webhooks/refunds).
              </p>
            </div>
          </div>
          <Link 
            href="/admin/applications?attention=true"
            className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
          >
            View All <ArrowRight className="ml-2 size-4" />
          </Link>
        </div>
      )}

      {isAttentionView && (
        <div className="bg-muted p-3 flex justify-between items-center">
          <span className="text-sm font-medium">Filtering by: Attention Required</span>
          <Link href="/admin/applications" className="text-xs text-primary hover:underline">
            Clear filter
          </Link>
        </div>
      )}

      <div className="border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">ID</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Status</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Payment</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Attention</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground">Created</th>
                <th className="p-4 text-xs font-bold uppercase text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((app) => (
                <tr key={app.id} className="hover:bg-muted/50 transition-colors">
                  <td className="p-4 font-mono text-sm">{app.id}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {app.applicationStatus}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-medium text-muted-foreground">
                      {app.paymentStatus}
                    </span>
                  </td>
                  <td className="p-4">
                    {app.adminAttentionRequired ? (
                      <span className="text-destructive text-xs font-bold animate-bounce">
                        ⚠️ FLAG
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {app.createdAt.toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <Link 
                      href={`/admin/applications/${app.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                    No applications found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
