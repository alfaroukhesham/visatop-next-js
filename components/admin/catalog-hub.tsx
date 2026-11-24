"use client";

import Link from "next/link";
import type { FC } from "react";
import { CatalogNationalityList } from "@/components/admin/catalog-nationality-list";
import { CatalogServiceList } from "@/components/admin/catalog-service-list";
import { CheckoutExtrasPanel } from "@/components/admin/checkout-extras-panel";
import { LocalCurrenciesPanel } from "@/components/admin/local-currencies-panel";
import { cn } from "@/lib/utils";
import type {
  CatalogLocalCurrency,
  CatalogNationality,
  CatalogService,
} from "@/lib/admin/catalog/catalog-types";
import type { TCheckoutExtraAdmin } from "@/lib/checkout-extras/types";

type TCatalogHubTab = "services" | "nationalities" | "local-currencies" | "extras";

interface ICatalogHubProps {
  tab: TCatalogHubTab;
  nationalities: CatalogNationality[];
  services: CatalogService[];
  localCurrencies: CatalogLocalCurrency[];
  extras: TCheckoutExtraAdmin[];
  fxAedPerUsd: string | null;
  canWrite: boolean;
}

const TABS = [
  { id: "services" as const, href: "/admin/catalog?tab=services", label: "Services" },
  { id: "nationalities" as const, href: "/admin/catalog?tab=nationalities", label: "Nationalities" },
  { id: "local-currencies" as const, href: "/admin/catalog?tab=local-currencies", label: "Local currencies" },
  { id: "extras" as const, href: "/admin/catalog?tab=extras", label: "Extras" },
] as const;

export const CatalogHub: FC<ICatalogHubProps> = ({
  tab,
  nationalities,
  services,
  localCurrencies,
  extras,
  fxAedPerUsd,
  canWrite,
}) => {
  return (
    <div className="space-y-8">
      <div
        className="border-border flex flex-wrap gap-1 border-b"
        role="tablist"
        aria-label="Catalog sections"
      >
        {TABS.map(({ id, href, label }) => (
          <Link
            key={id}
            href={href}
            role="tab"
            aria-selected={tab === id}
            className={cn(
              "font-body -mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {label}
          </Link>
        ))}
      </div>
      {tab === "services" ? (
        <CatalogServiceList services={services} canWrite={canWrite} />
      ) : tab === "nationalities" ? (
        <CatalogNationalityList nationalities={nationalities} canWrite={canWrite} />
      ) : tab === "local-currencies" ? (
        <LocalCurrenciesPanel
          localCurrencies={localCurrencies}
          nationalities={nationalities}
          canWrite={canWrite}
        />
      ) : (
        <CheckoutExtrasPanel extras={extras} fxAedPerUsd={fxAedPerUsd} canWrite={canWrite} />
      )}
    </div>
  );
};
