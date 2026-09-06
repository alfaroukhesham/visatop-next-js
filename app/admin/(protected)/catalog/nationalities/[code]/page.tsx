import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { CatalogNationalityForm } from "@/components/admin/catalog-nationality-form";
import { CatalogEligibilityLinks } from "@/components/admin/catalog-eligibility-links";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCatalogNationality } from "@/lib/admin/catalog/get-catalog-entity";
import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { withAdminDbActor } from "@/lib/db/actor-context";
import type { CatalogNationality } from "@/lib/admin/catalog/catalog-types";

type TView =
  | { kind: "forbidden" }
  | { kind: "missing" }
  | { kind: "ok"; canWrite: boolean; nationality: CatalogNationality };

export default async function AdminCatalogNationalityPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ added?: string | string[] }>;
}) {
  const [{ code: rawCode }, adminUserId, sp] = await Promise.all([params, getAdminUserId(), searchParams]);
  const code = decodeURIComponent(rawCode).toUpperCase();
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
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

  const addedRaw = Array.isArray(sp.added) ? sp.added[0] : sp.added;
  const added = addedRaw ? Number.parseInt(addedRaw, 10) : 0;
  const initialBanner =
    Number.isFinite(added) && added > 0
      ? `Added ${added} link${added === 1 ? "" : "s"}.`
      : null;

  const view = await withAdminDbActor(adminUserId, async ({ tx, permissions }): Promise<TView> => {
    if (!permissions.includes("catalog.read")) return { kind: "forbidden" };
    const nationality = await getCatalogNationality(tx, code);
    if (!nationality) return { kind: "missing" };
    return {
      kind: "ok",
      canWrite: permissions.includes("catalog.write") && permissions.includes("audit.write"),
      nationality,
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
        title="Nationality"
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
      title={`${view.nationality.name} (${view.nationality.code})`}
      active="catalog"
      subtitle="Edit this nationality and its eligible services."
    >
      <div className="space-y-6">
        <CatalogNationalityForm
          mode="edit"
          nationality={view.nationality}
          canWrite={view.canWrite}
        />
        <CatalogEligibilityLinks
          mode="nationality"
          nationalityCode={view.nationality.code}
          canWrite={view.canWrite}
          addHref={`/admin/catalog/nationalities/${encodeURIComponent(view.nationality.code)}/services/add`}
          initialBanner={initialBanner}
        />
      </div>
    </AdminShell>
  );
}
