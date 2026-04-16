import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { adminAuth } from "@/lib/admin-auth";
import {
  AdminPricingWorkspace,
  type AffiliateSiteRow,
  type MarginPolicyRow,
  type ReferencePriceRow,
  type ServiceOption,
} from "@/components/admin/pricing-workspace";
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

export default async function AdminPricingPage() {
  const hdrs = await headers();
  const session = await adminAuth.api.getSession({ headers: hdrs });
  if (!session) {
    redirect("/admin/sign-in?callbackUrl=%2Fadmin%2Fpricing");
  }

  const view = await withAdminDbActor(session.user.id, async ({ tx, permissions }) => {
    if (!permissions.includes("pricing.read")) {
      return { kind: "forbidden" as const };
    }
    const canWrite =
      permissions.includes("pricing.write") && permissions.includes("audit.write");
    const margins = await tx
      .select()
      .from(schema.marginPolicy)
      .orderBy(desc(schema.marginPolicy.updatedAt))
      .limit(80);
    const refs = await tx
      .select({
        id: schema.affiliateReferencePrice.id,
        siteId: schema.affiliateReferencePrice.siteId,
        serviceId: schema.affiliateReferencePrice.serviceId,
        serviceName: schema.visaService.name,
        amount: schema.affiliateReferencePrice.amount,
        currency: schema.affiliateReferencePrice.currency,
        observedAt: schema.affiliateReferencePrice.observedAt,
      })
      .from(schema.affiliateReferencePrice)
      .innerJoin(schema.visaService, eq(schema.visaService.id, schema.affiliateReferencePrice.serviceId))
      .orderBy(desc(schema.affiliateReferencePrice.observedAt))
      .limit(80);
    const sites = await tx
      .select({
        id: schema.affiliateSite.id,
        domain: schema.affiliateSite.domain,
        enabled: schema.affiliateSite.enabled,
      })
      .from(schema.affiliateSite)
      .orderBy(asc(schema.affiliateSite.domain));
    const services = await tx
      .select({
        id: schema.visaService.id,
        name: schema.visaService.name,
      })
      .from(schema.visaService)
      .orderBy(asc(schema.visaService.name));
    return {
      kind: "ok" as const,
      margins,
      refs,
      sites,
      services,
      canWrite,
    };
  });

  if (view.kind === "forbidden") {
    return (
      <AdminShell
        title="Pricing"
        active="pricing"
        subtitle="You do not have pricing.read. Catalog overview may still be available."
      >
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>
              This workspace requires <span className="font-mono">pricing.read</span>.{" "}
              <Link href="/admin/catalog" className="text-primary underline">
                Open catalog
              </Link>
            </CardDescription>
          </CardHeader>
        </Card>
      </AdminShell>
    );
  }

  const marginPolicies: MarginPolicyRow[] = view.margins.map((m) => ({
    id: m.id,
    scope: m.scope,
    serviceId: m.serviceId,
    mode: m.mode,
    value: String(m.value),
    currency: m.currency,
    enabled: m.enabled,
  }));

  const referencePrices: ReferencePriceRow[] = view.refs.map((r) => ({
    id: r.id,
    siteId: r.siteId,
    serviceId: r.serviceId,
    serviceName: r.serviceName,
    amount: r.amount,
    currency: r.currency,
    observedAt:
      r.observedAt instanceof Date ? r.observedAt.toISOString() : String(r.observedAt),
  }));

  const sites: AffiliateSiteRow[] = view.sites;
  const services: ServiceOption[] = view.services;

  return (
    <AdminShell
      title="Margins & reference prices"
      active="pricing"
      subtitle="Configure markup rules and record affiliate reference observations. Writes require pricing.write and audit.write."
    >
      <AdminPricingWorkspace
        marginPolicies={marginPolicies}
        referencePrices={referencePrices}
        services={services}
        sites={sites}
        canRead
        canWrite={view.canWrite}
      />
    </AdminShell>
  );
}
