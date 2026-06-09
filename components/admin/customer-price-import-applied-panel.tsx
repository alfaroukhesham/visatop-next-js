"use client";

import { CustomerPriceImportApplySummary } from "@/components/admin/customer-price-import-apply-summary";
import { CustomerPriceImportPendingWizard } from "@/components/admin/customer-price-import-pending-wizard";
import type {
  ApplyResult,
  ImportPhase,
  PendingImportListRow,
} from "@/components/admin/customer-price-import-types";

export type CustomerPriceImportAppliedPanelProps = {
  applyResult: ApplyResult;
  phase: ImportPhase;
  assignElapsedSec: number;
  pendingCurrency: "USD" | "AED";
  onPendingCurrencyChange: (currency: "USD" | "AED") => void;
  pendingPageSize: number;
  onPendingPageSizeChange: (size: number) => void;
  pendingPage: number;
  pendingListRows: PendingImportListRow[];
  pendingListTotal: number;
  pendingListLoading: boolean;
  onPendingPageChange: (page: number) => void;
  onAssignPendingCurrency: () => void;
  canWrite: boolean;
};

export function CustomerPriceImportAppliedPanel({
  applyResult,
  phase,
  assignElapsedSec,
  pendingCurrency,
  onPendingCurrencyChange,
  pendingPageSize,
  onPendingPageSizeChange,
  pendingPage,
  pendingListRows,
  pendingListTotal,
  pendingListLoading,
  onPendingPageChange,
  onAssignPendingCurrency,
  canWrite,
}: CustomerPriceImportAppliedPanelProps) {
  return (
    <div className="space-y-4">
      <CustomerPriceImportPendingWizard
        applyResult={applyResult}
        phase={phase}
        assignElapsedSec={assignElapsedSec}
        pendingCurrency={pendingCurrency}
        onPendingCurrencyChange={onPendingCurrencyChange}
        pendingPageSize={pendingPageSize}
        onPendingPageSizeChange={onPendingPageSizeChange}
        pendingPage={pendingPage}
        pendingListRows={pendingListRows}
        pendingListTotal={pendingListTotal}
        pendingListLoading={pendingListLoading}
        onPendingPageChange={onPendingPageChange}
        onAssignPendingCurrency={onAssignPendingCurrency}
        canWrite={canWrite}
      />
      <CustomerPriceImportApplySummary applyResult={applyResult} />
    </div>
  );
}
