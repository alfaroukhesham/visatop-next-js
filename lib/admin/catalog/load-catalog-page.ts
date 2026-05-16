import { desc } from "drizzle-orm";
import { withAdminDbActor } from "@/lib/db/actor-context";
import * as schema from "@/lib/db/schema";
import type { CatalogNationality, CatalogService } from "@/lib/admin/catalog/catalog-types";

export type CatalogPageView =
  | { kind: "forbidden" }
  | {
      kind: "ok";
      nationalities: CatalogNationality[];
      services: CatalogService[];
      canWrite: boolean;
    };

/** SSR catalog shell: nationalities + services only (eligibility is paged via API). */
export async function loadCatalogPage(adminUserId: string): Promise<CatalogPageView> {
  return withAdminDbActor(adminUserId, async ({ tx, permissions }) => {
    if (!permissions.includes("catalog.read")) {
      return { kind: "forbidden" };
    }
    const canWrite =
      permissions.includes("catalog.write") && permissions.includes("audit.write");

    const [nationalities, services] = await Promise.all([
      tx
        .select({
          code: schema.nationality.code,
          name: schema.nationality.name,
          enabled: schema.nationality.enabled,
        })
        .from(schema.nationality)
        .orderBy(schema.nationality.name),
      tx
        .select({
          id: schema.visaService.id,
          name: schema.visaService.name,
          enabled: schema.visaService.enabled,
          durationDays: schema.visaService.durationDays,
          entries: schema.visaService.entries,
        })
        .from(schema.visaService)
        .orderBy(desc(schema.visaService.createdAt)),
    ]);

    return { kind: "ok", nationalities, services, canWrite };
  });
}
