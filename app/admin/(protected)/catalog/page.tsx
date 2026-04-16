import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { adminAuth } from "@/lib/admin-auth";
import {
  AdminCatalogWorkspace,
  type CatalogEligibility,
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
import { withAdminDbActor } from "@/lib/db/actor-context";
import * as schema from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage() {
  const hdrs = await headers();
  const session = await adminAuth.api.getSession({ headers: hdrs });
  if (!session) {
    redirect("/admin/sign-in?callbackUrl=%2Fadmin%2Fcatalog");
  }

  const view = await withAdminDbActor(session.user.id, async ({ tx, permissions }) => {
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
    const services = await tx
      .select({
        id: schema.visaService.id,
        name: schema.visaService.name,
        enabled: schema.visaService.enabled,
        durationDays: schema.visaService.durationDays,
        entries: schema.visaService.entries,
      })
      .from(schema.visaService)
      .orderBy(desc(schema.visaService.createdAt));
    const eligibility = await tx
      .select({
        serviceId: schema.visaServiceEligibility.serviceId,
        nationalityCode: schema.visaServiceEligibility.nationalityCode,
        serviceName: schema.visaService.name,
      })
      .from(schema.visaServiceEligibility)
      .innerJoin(
        schema.visaService,
        eq(schema.visaService.id, schema.visaServiceEligibility.serviceId),
      )
      .orderBy(asc(schema.visaService.name), asc(schema.visaServiceEligibility.nationalityCode));
    return {
      kind: "ok" as const,
      nationalities,
      services,
      eligibility,
      canWrite,
    };
  });

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
  const eligibility: CatalogEligibility[] = view.eligibility;

  return (
    <AdminShell
      title="Visa catalog"
      active="catalog"
      subtitle="Nationalities, visa services, and eligibility pairs that power the public apply flow and catalog APIs."
    >
      <AdminCatalogWorkspace
        nationalities={nationalities}
        services={services}
        eligibility={eligibility}
        canWrite={view.canWrite}
      />
    </AdminShell>
  );
}
