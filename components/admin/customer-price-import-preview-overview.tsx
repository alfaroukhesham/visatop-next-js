"use client";

import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Wand2 } from "lucide-react";
import type { PreviewResult } from "@/components/admin/customer-price-import-types";

export type CustomerPriceImportPreviewOverviewProps = {
  preview: PreviewResult;
};

export function CustomerPriceImportPreviewOverview({
  preview,
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
