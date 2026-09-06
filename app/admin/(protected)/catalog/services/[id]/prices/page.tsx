import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { CatalogServicePriceWorkspace } from "@/components/admin/catalog-service-price-workspace";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCatalogVisaService } from "@/lib/admin/catalog/get-catalog-entity";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";

type TView =
  | { kind: "forbidden" }
  | { kind: "missing" }
  | { kind: "ok"; canWrite: boolean; serviceId: string; serviceName: string };

export default async function AdminCatalogServicePricesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id: rawId }, adminUserId] = await Promise.all([params, getAdminUserId()]);
  const id = decodeURIComponent(rawId);

  const view = await withAdminDbActor(adminUserId, async ({ tx, permissions }): Promise<TView> => {
    if (!permissions.includes("catalog.read")) return { kind: "forbidden" };
    const service = await getCatalogVisaService(tx, id);
    if (!service) return { kind: "missing" };
    return {
      kind: "ok",
      canWrite: permissions.includes("catalog.write") && permissions.includes("audit.write"),
      serviceId: service.id,
      serviceName: service.name,
    };
  });

  if (view.kind === "missing") {
    return (
      <AdminShell title="Catalog" active="catalog">
        <Card>
          <CardHeader>
            <CardTitle>Not found</CardTitle>
            <CardDescription>
              <Link href="/admin/catalog" className="underline underline-offset-4">
                Back to Catalog
              </Link>
            </CardDescription>
          </CardHeader>
        </Card>
      </AdminShell>
    );
  }

  if (view.kind === "forbidden") {
    return (
      <AdminShell
        title="Service prices"
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

  const editHref = `/admin/catalog/services/${encodeURIComponent(view.serviceId)}/edit`;

  return (
    <AdminShell
      title={`Prices · ${view.serviceName}`}
      active="catalog"
      subtitle="Set customer prices for this service."
    >
      <CatalogServicePriceWorkspace
        serviceId={view.serviceId}
        canWrite={view.canWrite}
        editHref={editHref}
      />
    </AdminShell>
  );
}
