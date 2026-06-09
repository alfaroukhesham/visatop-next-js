"use client";

import { CustomerPriceImportPreviewOverview } from "@/components/admin/customer-price-import-preview-overview";
import {
  CustomerPriceImportPreviewTables,
  type CustomerPriceImportPreviewTablesProps,
} from "@/components/admin/customer-price-import-preview-tables";
import type { PreviewResult } from "@/components/admin/customer-price-import-types";

export type CustomerPriceImportPreviewPanelProps = {
  preview: PreviewResult;
} & Omit<CustomerPriceImportPreviewTablesProps, "preview">;

export function CustomerPriceImportPreviewPanel({
  preview,
  ...tablesProps
}: CustomerPriceImportPreviewPanelProps) {
  return (
    <div className="space-y-4">
      <CustomerPriceImportPreviewOverview preview={preview} />
      <CustomerPriceImportPreviewTables preview={preview} {...tablesProps} />
    </div>
  );
}
