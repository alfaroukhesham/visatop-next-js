"use client";

import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Wand2 } from "lucide-react";
import type { PreviewResult } from "@/components/admin/customer-price-import-types";

export type CustomerPriceImportPreviewOverviewProps = {
  preview: PreviewResult;
  canWrite?: boolean;
  catalogScope?: "merge" | "replace";
  onCatalogScopeChange?: (scope: "merge" | "replace") => void;
};

export function CustomerPriceImportPreviewOverview({
  preview,
  canWrite = false,
  catalogScope = "replace",
  onCatalogScopeChange,
}: CustomerPriceImportPreviewOverviewProps) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            ["Data rows", preview.stats.dataRows],
            ["Priced cells", preview.stats.pricedCells],
            ["Ambiguous cells", preview.stats.ambiguousCells],
            ["Empty cells", preview.stats.emptyCells],
          ] as [string, number][]
        ).map(([label, count]) => (
          <Card key={label} className="p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tabular-nums">{count}</p>
          </Card>
        ))}
      </div>

      <Alert>
        <Info className="size-4" />
        <AlertTitle>Header detected</AlertTitle>
        <AlertDescription>
          {preview.headerRowIndex === -1
            ? "❌ No valid header row found. Ensure columns '#', 'Country', and at least one service column exist in the first 25 rows."
            : `✅ Header row found at row ${preview.headerRowIndex + 1}.`}
        </AlertDescription>
      </Alert>

      {canWrite && onCatalogScopeChange && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Catalog scope on apply</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-sm">
              <strong>Empty cells</strong> always disable that service for that nationality (remove prices and eligibility).
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-sm font-medium">Scope:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onCatalogScopeChange("replace")}
                  className={`px-3 py-1 rounded border text-sm font-medium transition-colors ${
                    catalogScope === "replace"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary"
                  }`}
                >
                  Replace (recommended)
                </button>
                <button
                  type="button"
                  onClick={() => onCatalogScopeChange("merge")}
                  className={`px-3 py-1 rounded border text-sm font-medium transition-colors ${
                    catalogScope === "merge"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary"
                  }`}
                >
                  Merge only
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Replace removes all prices for nationalities not in this sheet and drops service columns removed from the template.
              Merge only updates cells in the sheet and leaves other catalog prices untouched.
              Re-applying the same sheet is a no-op when the catalog already matches.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {preview.stats.emptyCells > 0 && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>{preview.stats.emptyCells} empty cell(s)</AlertTitle>
          <AlertDescription className="text-sm">
            These nationality×service pairs will be <strong>disabled</strong> on apply (prices cleared, not offered in catalog).
          </AlertDescription>
        </Alert>
      )}

      {preview.unknownServices.length > 0 && (
        <Alert>
          <Wand2 className="size-4" />
          <AlertTitle>New services will be created</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc list-inside text-sm">
              {preview.unknownServices.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
