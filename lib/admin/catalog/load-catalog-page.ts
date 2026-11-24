import { desc } from "drizzle-orm";
import { withAdminDbActor } from "@/lib/db/actor-context";
import * as schema from "@/lib/db/schema";
import type {
  CatalogLocalCurrency,
  CatalogNationality,
  CatalogService,
} from "@/lib/admin/catalog/catalog-types";
import { listAdminLocalCurrencies } from "@/lib/admin/catalog/local-currency-admin";
import { listCheckoutExtras } from "@/lib/checkout-extras/checkout-extra-admin";
import type { TCheckoutExtraAdmin } from "@/lib/checkout-extras/types";
import { peekResolvedFxRateFromTx } from "@/lib/pricing/fx-usd-aed";

export type CatalogPageView =
  | { kind: "forbidden" }
  | {
      kind: "ok";
      nationalities: CatalogNationality[];
      services: CatalogService[];
      localCurrencies: CatalogLocalCurrency[];
      extras: TCheckoutExtraAdmin[];
      fxAedPerUsd: string | null;
      canWrite: boolean;
    };

/** SSR catalog shell: nationalities, services, local currencies, and checkout extras. */
export async function loadCatalogPage(adminUserId: string): Promise<CatalogPageView> {
  return withAdminDbActor(adminUserId, async ({ tx, permissions }) => {
    if (!permissions.includes("catalog.read")) {
      return { kind: "forbidden" };
    }
    const canWrite =
      permissions.includes("catalog.write") && permissions.includes("audit.write");

    const [nationalities, services, localCurrencies, extras, fx] = await Promise.all([
      tx
        .select({
          code: schema.nationality.code,
          name: schema.nationality.name,
          dialCode: schema.nationality.dialCode,
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
          stayBucket: schema.visaService.stayBucket,
          entryKind: schema.visaService.entryKind,
          travelerKind: schema.visaService.travelerKind,
          showInGuidedChooser: schema.visaService.showInGuidedChooser,
        })
        .from(schema.visaService)
        .orderBy(desc(schema.visaService.createdAt)),
      listAdminLocalCurrencies(tx),
      listCheckoutExtras(tx),
      peekResolvedFxRateFromTx(tx),
    ]);

    return {
      kind: "ok",
      nationalities,
      services: services as CatalogService[],
      localCurrencies,
      extras,
      fxAedPerUsd: fx.fxAedPerUsd,
      canWrite,
    };
  });
}
