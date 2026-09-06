import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { CatalogServiceForm } from "@/components/admin/catalog-service-form";
import { CatalogEligibilityLinks } from "@/components/admin/catalog-eligibility-links";
import { CatalogServicePriceActions } from "@/components/admin/catalog-service-price-actions";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCatalogVisaService } from "@/lib/admin/catalog/get-catalog-entity";
import { listServicePricing } from "@/lib/admin/catalog/list-service-pricing";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";
import type { CatalogService } from "@/lib/admin/catalog/catalog-types";

type TPriceByNationality = Record<string, { aedMajor: string; usdMajor: string }>;

const buildPriceByNationality = (
  groups: Array<{ aedMajor: string; usdMajor: string; nationalityCodes: string[] }>,
): TPriceByNationality => {
  const map: TPriceByNationality = {};
  for (const group of groups) {
    for (const code of group.nationalityCodes) {
      map[code] = { aedMajor: group.aedMajor, usdMajor: group.usdMajor };
    }
  }
  return map;
};

type TView =
  | { kind: "forbidden" }
  | { kind: "missing" }
  | {
      kind: "ok";
      canWrite: boolean;
      service: CatalogService;
      fxConfigured: boolean;
      fxAedPerUsd: string | null;
      priceByNationality: TPriceByNationality;
    };

export default async function AdminCatalogServiceEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ added?: string | string[] }>;
}) {
  const [{ id: rawId }, adminUserId, sp] = await Promise.all([params, getAdminUserId(), searchParams]);
  const id = decodeURIComponent(rawId);

  const addedRaw = Array.isArray(sp.added) ? sp.added[0] : sp.added;
  const added = addedRaw ? Number.parseInt(addedRaw, 10) : 0;
  const initialBanner =
    Number.isFinite(added) && added > 0
      ? `Added ${added} link${added === 1 ? "" : "s"}.`
      : null;

  const view = await withAdminDbActor(adminUserId, async ({ tx, permissions }): Promise<TView> => {
    if (!permissions.includes("catalog.read")) return { kind: "forbidden" };
    const service = await getCatalogVisaService(tx, id);
    if (!service) return { kind: "missing" };
    const pricing = await listServicePricing(tx, id);
    return {
      kind: "ok",
      canWrite: permissions.includes("catalog.write") && permissions.includes("audit.write"),
      service,
      fxConfigured: pricing?.fxConfigured ?? false,
      fxAedPerUsd: pricing?.fxAedPerUsd ?? null,
      priceByNationality: buildPriceByNationality(pricing?.groups ?? []),
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
        title="Edit service"
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
      title={view.service.name}
      active="catalog"
      subtitle="Edit this service."
    >
      <div className="space-y-6">
        <CatalogServiceForm mode="edit" service={view.service} canWrite={view.canWrite} />
        <CatalogServicePriceActions
          serviceId={view.service.id}
          canWrite={view.canWrite}
          pricesHref={`/admin/catalog/services/${encodeURIComponent(view.service.id)}/prices`}
          fxConfigured={view.fxConfigured}
          fxAedPerUsd={view.fxAedPerUsd}
        />
        <CatalogEligibilityLinks
          mode="service"
          serviceId={view.service.id}
          canWrite={view.canWrite}
          addHref={`/admin/catalog/services/${encodeURIComponent(view.service.id)}/nationalities/add`}
          initialBanner={initialBanner}
          priceByNationality={view.priceByNationality}
        />
      </div>
    </AdminShell>
  );
}
