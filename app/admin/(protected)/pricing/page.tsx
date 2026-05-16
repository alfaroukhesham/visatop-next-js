import { getAdminUserId } from "@/lib/admin/get-admin-session";
import { AdminShell } from "@/components/admin/admin-shell";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { CustomerPriceImport } from "@/components/admin/customer-price-import";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const adminUserId = await getAdminUserId();

  const view = await withAdminDbActor(adminUserId, async ({ permissions }) => {
    if (!permissions.includes("catalog.read")) {
      return { kind: "forbidden" as const };
    }
    const canWrite =
      permissions.includes("catalog.write") && permissions.includes("audit.write");
    return { kind: "ok" as const, canWrite };
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
      subtitle="Import nationality × service prices from Excel files. One price per currency; missing currency auto-filled via FX rate."
    >
      <CustomerPriceImport canWrite={view.canWrite} />
    </AdminShell>
  );
}
