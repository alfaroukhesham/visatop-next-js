"use client";

import type { Dispatch, SetStateAction } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AdminTableLoadingFrame,
  AdminTableLoadingSkeleton,
} from "@/components/admin/admin-loading";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
import type { CatalogEligibility } from "@/lib/admin/catalog/catalog-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EligPage = {
  loading: boolean;
  items: CatalogEligibility[];
  pageSize: number;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  onPageSizeChange: (size: number) => void;
  total: number;
};

type CatalogEligibilityTableProps = {
  canWrite: boolean;
  sectionBusy: boolean;
  eligBusy: string | null;
  hasActiveFilters: boolean;
  eligPage: EligPage;
  onRemove: (serviceId: string, nationalityCode: string) => void;
};

export function CatalogEligibilityTable({
  canWrite,
  sectionBusy,
  eligBusy,
  hasActiveFilters,
  eligPage,
  onRemove,
}: CatalogEligibilityTableProps) {
  return (
    <>
      <AdminTableLoadingFrame
        loading={eligPage.loading}
        hasRows={eligPage.items.length > 0}
        className="overflow-x-auto rounded-md border border-border"
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Service</th>
              <th className="px-4 py-2 font-medium">Nationality</th>
              {canWrite ? <th className="px-4 py-2 font-medium">Remove</th> : null}
            </tr>
          </thead>
          <tbody
            className={cn(
              "divide-border divide-y",
              eligPage.loading && eligPage.items.length === 0 && "admin-stagger",
            )}
          >
            {eligPage.loading && eligPage.items.length === 0 ? (
              <AdminTableLoadingSkeleton
                rows={Math.min(eligPage.pageSize, 8)}
                columns={canWrite ? 3 : 2}
                columnWidths={canWrite ? ["w-2/5", "w-20", "w-10"] : ["w-2/5", "w-20"]}
              />
            ) : null}
            {!eligPage.loading && eligPage.items.length === 0 ? (
              <tr>
                <td
                  colSpan={canWrite ? 3 : 2}
                  className="text-muted-foreground px-4 py-6 text-center text-sm"
                >
                  {hasActiveFilters
                    ? "No eligibility links match your filters."
                    : "No eligibility links yet."}
                </td>
              </tr>
            ) : null}
            {eligPage.items.map((e) => (
              <tr key={`${e.serviceId}-${e.nationalityCode}`} className="hover:bg-muted/30">
                <td className="px-4 py-2">
                  <span className="font-medium">{e.serviceName}</span>
                  <div className="text-muted-foreground font-mono text-[10px] break-all">{e.serviceId}</div>
                  {!e.hasPrice ? (
                    <p className="text-muted-foreground text-sm">No price — hidden on apply.</p>
                  ) : null}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{e.nationalityCode}</td>
                {canWrite ? (
                  <td className="px-4 py-2">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={sectionBusy}
                      aria-label="Remove eligibility"
                      onClick={() => onRemove(e.serviceId, e.nationalityCode)}
                    >
                      {eligBusy === `elig-del-${e.serviceId}-${e.nationalityCode}` ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </AdminTableLoadingFrame>
      <ListPaginatorBar
        selectId="catalog-eligibility-page-size"
        page={eligPage.page}
        setPage={eligPage.setPage}
        pageSize={eligPage.pageSize}
        onPageSizeChange={eligPage.onPageSizeChange}
        total={eligPage.total}
        disabled={sectionBusy || eligPage.loading}
        loading={eligPage.loading}
      />
    </>
  );
}
