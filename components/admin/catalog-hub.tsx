"use client";

import Link from "next/link";
import type { FC } from "react";
import { CatalogNationalityList } from "@/components/admin/catalog-nationality-list";
import { CatalogServiceList } from "@/components/admin/catalog-service-list";
import { cn } from "@/lib/utils";
import type { CatalogNationality, CatalogService } from "@/lib/admin/catalog/catalog-types";

interface ICatalogHubProps {
  tab: "services" | "nationalities";
  nationalities: CatalogNationality[];
  services: CatalogService[];
  canWrite: boolean;
}

const TABS = [
  { id: "services" as const, href: "/admin/catalog?tab=services", label: "Services" },
  { id: "nationalities" as const, href: "/admin/catalog?tab=nationalities", label: "Nationalities" },
] as const;

export const CatalogHub: FC<ICatalogHubProps> = ({ tab, nationalities, services, canWrite }) => {
  return (
    <div className="space-y-8">
      <div
        className="border-border flex flex-wrap gap-1 border-b"
        role="tablist"
        aria-label="Services and nationalities"
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
      ) : (
        <CatalogNationalityList nationalities={nationalities} canWrite={canWrite} />
      )}
    </div>
  );
};
