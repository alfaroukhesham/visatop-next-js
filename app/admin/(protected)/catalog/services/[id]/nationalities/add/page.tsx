import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { CatalogEligibilityPicker } from "@/components/admin/catalog-eligibility-picker";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadCatalogPickerCandidates } from "@/lib/admin/catalog/load-catalog-picker";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";
import type { CatalogNationality } from "@/lib/admin/catalog/catalog-types";

type TView =
  | { kind: "forbidden" }
  | { kind: "missing" }
  | {
      kind: "ok";
      canWrite: boolean;
      serviceId: string;
      serviceName: string;
      nationalities: CatalogNationality[];
    };

export default async function AdminCatalogServiceNationalitiesAddPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id: rawId }, adminUserId] = await Promise.all([params, getAdminUserId()]);
  const id = decodeURIComponent(rawId);

  const view = await withAdminDbActor(adminUserId, async ({ tx, permissions }): Promise<TView> => {
    if (!permissions.includes("catalog.read")) return { kind: "forbidden" };
    const candidates = await loadCatalogPickerCandidates(tx, { serviceId: id });
    if (!candidates || candidates.kind !== "service") return { kind: "missing" };
    return {
      kind: "ok",
      canWrite: permissions.includes("catalog.write") && permissions.includes("audit.write"),
      serviceId: candidates.service.id,
      serviceName: candidates.service.name,
      nationalities: candidates.nationalities,
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
        title="Add nationalities"
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
      title={`Add nationalities · ${view.serviceName}`}
      active="catalog"
      subtitle="Link eligible nationalities to this service."
    >
      <CatalogEligibilityPicker
        mode="service"
        serviceId={view.serviceId}
        parentHref={`/admin/catalog/services/${encodeURIComponent(view.serviceId)}/edit`}
        canWrite={view.canWrite}
        candidates={view.nationalities}
      />
    </AdminShell>
  );
}
