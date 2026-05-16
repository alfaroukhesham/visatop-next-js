import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { AdminShell } from "@/components/admin/admin-shell";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { CustomerPriceImport } from "@/components/admin/customer-price-import";
import { NationalityPriceEditor } from "@/components/admin/nationality-price-editor";
import * as schema from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const adminUserId = await getAdminUserId();

  const view = await withAdminDbActor(adminUserId, async ({ tx, permissions }) => {
    if (!permissions.includes("catalog.read")) {
      return { kind: "forbidden" as const };
    }
    const canWrite =
      permissions.includes("catalog.write") && permissions.includes("audit.write");

    const nationalities = await tx
      .select({
        code: schema.nationality.code,
        name: schema.nationality.name,
        enabled: schema.nationality.enabled,
      })
      .from(schema.nationality)
      .orderBy(schema.nationality.name);

    return { kind: "ok" as const, canWrite, nationalities };
  });

  if (view.kind === "forbidden") {
    return (
      <AdminShell
        title="Catalog Pricing"
        active="pricing"
        subtitle="You do not have catalog.read permission."
      >
        <p className="text-sm text-muted-foreground">
          Contact an administrator to grant access.
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Catalog Customer Prices"
      active="pricing"
      subtitle="Bulk import from Excel or update prices per nationality in the catalog."
    >
      <div className="space-y-10">
        <CustomerPriceImport canWrite={view.canWrite} />
        <NationalityPriceEditor nationalities={view.nationalities} canWrite={view.canWrite} />
      </div>
    </AdminShell>
  );
}
