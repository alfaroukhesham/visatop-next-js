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
import type { CatalogService } from "@/lib/admin/catalog/catalog-types";

type TView =
  | { kind: "forbidden" }
  | { kind: "missing" }
  | {
      kind: "ok";
      canWrite: boolean;
      nationalityCode: string;
      nationalityName: string;
      services: CatalogService[];
    };

export default async function AdminCatalogNationalityServicesAddPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [{ code: rawCode }, adminUserId] = await Promise.all([params, getAdminUserId()]);
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

  const view = await withAdminDbActor(adminUserId, async ({ tx, permissions }): Promise<TView> => {
    if (!permissions.includes("catalog.read")) return { kind: "forbidden" };
    const candidates = await loadCatalogPickerCandidates(tx, { nationalityCode: code });
    if (!candidates || candidates.kind !== "nationality") return { kind: "missing" };
    return {
      kind: "ok",
      canWrite: permissions.includes("catalog.write") && permissions.includes("audit.write"),
      nationalityCode: candidates.nationality.code,
      nationalityName: candidates.nationality.name,
      services: candidates.services,
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
        title="Add services"
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
      title={`Add services · ${view.nationalityName}`}
      active="catalog"
      subtitle="Link eligible services to this nationality."
    >
      <CatalogEligibilityPicker
        mode="nationality"
        nationalityCode={view.nationalityCode}
        parentHref={`/admin/catalog/nationalities/${encodeURIComponent(view.nationalityCode)}`}
        canWrite={view.canWrite}
        candidates={view.services}
      />
    </AdminShell>
  );
}
