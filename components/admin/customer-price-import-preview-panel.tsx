"use client";

import { CustomerPriceImportPreviewOverview } from "@/components/admin/customer-price-import-preview-overview";
import {
  CustomerPriceImportPreviewTables,
  type CustomerPriceImportPreviewTablesProps,
} from "@/components/admin/customer-price-import-preview-tables";
import type { PreviewResult } from "@/components/admin/customer-price-import-types";

export type CustomerPriceImportPreviewPanelProps = {
  preview: PreviewResult;
  canWrite: boolean;
  catalogScope: "merge" | "replace";
  onCatalogScopeChange: (scope: "merge" | "replace") => void;
} & Omit<CustomerPriceImportPreviewTablesProps, "preview">;

export function CustomerPriceImportPreviewPanel({
  preview,
  canWrite,
  catalogScope,
  onCatalogScopeChange,
  ...tablesProps
}: CustomerPriceImportPreviewPanelProps) {
  return (
    <div className="space-y-4">
      <CustomerPriceImportPreviewOverview
        preview={preview}
        canWrite={canWrite}
        catalogScope={catalogScope}
        onCatalogScopeChange={onCatalogScopeChange}
      />
      <CustomerPriceImportPreviewTables preview={preview} canWrite={canWrite} {...tablesProps} />
    </div>
  );
}
