import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { getAttentionRequiredCount } from "@/lib/applications/admin-queries";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminApplicationsListClient } from "@/components/admin/admin-applications-list-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Applications | Admin",
};

export default async function AdminApplicationsPage() {
  const adminUserId = await getAdminUserId();

  const attentionCount = await withAdminDbActor(adminUserId, async ({ tx }) =>
    getAttentionRequiredCount(tx),
  );

  return (
    <AdminShell
      title="Applications"
      subtitle="Review, manage, and monitor all visa applications across the platform."
      active="applications"
    >
      <AdminApplicationsListClient initialAttentionCount={attentionCount} />
    </AdminShell>
  );
}
