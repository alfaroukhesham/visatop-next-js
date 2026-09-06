import { CatalogHub } from "@/components/admin/catalog-hub";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadCatalogPage } from "@/lib/admin/catalog/load-catalog-page";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import type { CatalogNationality, CatalogService } from "@/lib/admin/catalog/catalog-types";

function normalizeTab(value: string | string[] | undefined): "services" | "nationalities" {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "nationalities" ? "nationalities" : "services";
}

type PageProps = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function AdminCatalogPage({ searchParams }: PageProps) {
  const [adminUserId, sp] = await Promise.all([getAdminUserId(), searchParams]);
  const tab = normalizeTab(sp.tab);
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
      title="Catalog"
      active="catalog"
      subtitle="Manage services and nationalities."
    >
      <CatalogHub tab={tab} nationalities={nationalities} services={services} canWrite={view.canWrite} />
    </AdminShell>
  );
}
