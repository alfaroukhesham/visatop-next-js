"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AdminFormLoadingSkeleton } from "@/components/admin/admin-loading";
import type { NationalityOption } from "@/components/admin/nationality-price-editor";
import { cn } from "@/lib/utils";

const CustomerPriceImport = dynamic(
  () =>
    import("@/components/admin/customer-price-import").then((m) => ({
      default: m.CustomerPriceImport,
    })),
  { loading: () => <AdminFormLoadingSkeleton fields={2} /> },
);

const NationalityPriceEditor = dynamic(
  () =>
    import("@/components/admin/nationality-price-editor").then((m) => ({
      default: m.NationalityPriceEditor,
    })),
  { loading: () => <AdminFormLoadingSkeleton fields={3} /> },
);

type AdminPricingSectionsProps = {
  canWrite: boolean;
  nationalities: NationalityOption[];
};

export function AdminPricingSections({ canWrite, nationalities }: AdminPricingSectionsProps) {
  const [tab, setTab] = useState<"import" | "editor">("import");

  return (
    <div className="space-y-8">
      <div
        className="border-border flex flex-wrap gap-1 border-b"
        role="tablist"
        aria-label="Pricing tools"
      >
        {(
          [
            { id: "import" as const, label: "Bulk import" },
            { id: "editor" as const, label: "Per nationality" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cn(
              "font-body -mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "import" ? (
        <CustomerPriceImport canWrite={canWrite} />
      ) : (
        <NationalityPriceEditor nationalities={nationalities} canWrite={canWrite} />
      )}
    </div>
  );
}
