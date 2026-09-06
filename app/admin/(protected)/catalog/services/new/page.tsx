import { AdminShell } from "@/components/admin/admin-shell";
import { CatalogServiceForm } from "@/components/admin/catalog-service-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";

export const metadata = {
  title: "Add service | Admin",
};

type TView = { kind: "forbidden" } | { kind: "ok"; canWrite: boolean };

export default async function AdminCatalogServiceNewPage() {
  const adminUserId = await getAdminUserId();
  const view = await withAdminDbActor(adminUserId, async ({ permissions }): Promise<TView> => {
    if (!permissions.includes("catalog.read")) return { kind: "forbidden" };
    return {
      kind: "ok",
      canWrite: permissions.includes("catalog.write") && permissions.includes("audit.write"),
    };
  });

  if (view.kind === "forbidden") {
    return (
      <AdminShell
        title="Add service"
        active="catalog"
        subtitle="You do not have catalog.read."
      >
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>
              This workspace requires <span className="font-mono">catalog.read</span>.
            </CardDescription>
          </CardHeader>
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Add service"
      active="catalog"
      subtitle="Create a visa service variant."
    >
      <CatalogServiceForm mode="create" canWrite={view.canWrite} />
    </AdminShell>
  );
}
