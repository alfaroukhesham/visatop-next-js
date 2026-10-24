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

const normalizeTab = (
  value: string | string[] | undefined,
): "services" | "nationalities" | "local-currencies" => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "nationalities") return "nationalities";
  if (raw === "local-currencies") return "local-currencies";
  return "services";
};

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
  const services: CatalogService[] = view.services;

  return (
    <AdminShell
      title="Catalog"
      active="catalog"
      subtitle="Manage services, nationalities, and local currencies."
    >
      <CatalogHub
        tab={tab}
        nationalities={nationalities}
        services={services}
        localCurrencies={view.localCurrencies}
        canWrite={view.canWrite}
      />
    </AdminShell>
  );
}
