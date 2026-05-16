import {
  AdminCatalogWorkspace,
  type CatalogNationality,
  type CatalogService,
} from "@/components/admin/catalog-workspace";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadCatalogPage } from "@/lib/admin/catalog/load-catalog-page";
import { getAdminUserId } from "@/lib/admin/get-admin-session";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage() {
  const adminUserId = await getAdminUserId();
  const view = await loadCatalogPage(adminUserId);

  if (view.kind === "forbidden") {
    return (
      <AdminShell
        title="Catalog"
        active="catalog"
        subtitle="You do not have catalog.read. Ask a super admin to grant RBAC, or return to the overview."
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

  const nationalities: CatalogNationality[] = view.nationalities;
  const services: CatalogService[] = view.services.map((s) => ({
    id: s.id,
    name: s.name,
    enabled: s.enabled,
    durationDays: s.durationDays,
    entries: s.entries,
  }));

  return (
    <AdminShell
      title="Visa catalog"
      active="catalog"
      subtitle="Manage services and nationalities."
    >
      <AdminCatalogWorkspace
        nationalities={nationalities}
        services={services}
        canWrite={view.canWrite}
      />
    </AdminShell>
  );
}
