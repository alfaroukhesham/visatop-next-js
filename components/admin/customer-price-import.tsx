"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Upload, Info, Loader2 } from "lucide-react";
import { CustomerPriceImportPreviewPanel } from "@/components/admin/customer-price-import-preview-panel";
import { CustomerPriceImportAppliedPanel } from "@/components/admin/customer-price-import-applied-panel";
import { CustomerPriceImportBulkDialog } from "@/components/admin/customer-price-import-bulk-dialog";
import { useCustomerPriceImportController } from "@/components/admin/customer-price-import-controller";

export function CustomerPriceImport({ canWrite }: { canWrite: boolean }) {
  const {
    fileRef,
    state,
    patch,
    setPageField,
    previewSlices,
    hasBlockingErrors,
    hasErrors,
    missingNationalities,
    hasMissingNationalities,
    handlePreviewListPageSizeChange,
    loadPendingList,
    handlePreview,
    handleApply,
    handleAssignPendingCurrency,
    reset,
    openBulkNationalityModal,
    handleBulkCreateNationalities,
  } = useCustomerPriceImportController();

  const canApply =
    !!state.preview &&
    !hasBlockingErrors &&
    !hasMissingNationalities &&
    canWrite &&
    (!hasErrors || state.applyMode === "partial");

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-5" />
            Upload Price Sheet (XLSX)
          </CardTitle>
          <CardDescription>
            Upload the standard <code>Price Excel</code> format.
            Columns: <code>#</code>, <code>Country</code>, then one column per
            visa service. Contact info@visatop.com for any questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                id="price-sheet-file"
                type="file"
                accept=".xlsx,.xls"
                aria-label="Price sheet file"
                disabled={!canWrite || state.phase === "previewing" || state.phase === "applying"}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  patch({ file: f, preview: null, applyResult: null, error: null, phase: "idle" });
                }}
                className="block text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-border file:text-sm file:font-medium file:cursor-pointer"
              />
            </div>
            {!canWrite && (
              <Alert>
                <Info className="size-4" />
                <AlertTitle>Read-only</AlertTitle>
                <AlertDescription>
                  You need <code>catalog.write</code> and <code>audit.write</code> permissions to apply changes.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            id="btn-preview-sheet"
            onClick={handlePreview}
            disabled={!state.file || state.phase === "previewing" || state.phase === "applying"}
            variant="outline"
          >
            {state.phase === "previewing" && <Loader2 className="mr-2 size-4 animate-spin" />}
            Preview
          </Button>
          {state.preview && !hasBlockingErrors && (
            <Button
              id="btn-apply-sheet"
              onClick={handleApply}
              disabled={!canApply || state.phase === "applying" || state.phase === "applied"}
            >
              {state.phase === "applying" && <Loader2 className="mr-2 size-4 animate-spin" />}
              Apply Import {state.applyMode === "partial" ? "(Partial)" : "(Strict)"}
            </Button>
          )}
          {(state.preview || state.applyResult || state.error) && (
            <Button variant="ghost" onClick={reset}>
              Reset
            </Button>
          )}
        </CardFooter>
      </Card>

      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.phase === "applying" && (
        <Alert className="admin-rise">
          <Loader2 className="admin-loading-spin size-4" aria-hidden />
          <AlertTitle>Applying import…</AlertTitle>
          <AlertDescription className="text-sm">
            Large sheets can take a minute or more. This request runs entirely on the server; do not close the tab.
            <span className="mt-1 block tabular-nums text-muted-foreground">
              Elapsed {state.applyElapsedSec}s
            </span>
          </AlertDescription>
        </Alert>
      )}

      {state.preview && state.phase !== "applied" && (
        <CustomerPriceImportPreviewPanel
          preview={state.preview}
          phase={state.phase}
          previewSlices={previewSlices}
          missingNationalities={missingNationalities}
          hasMissingNationalities={hasMissingNationalities}
          canWrite={canWrite}
          applyMode={state.applyMode}
          onApplyModeChange={(mode) => patch({ applyMode: mode })}
          showAutoFix={state.showAutoFix}
          onToggleAutoFix={() => patch({ showAutoFix: !state.showAutoFix })}
          previewListPageSize={state.previewListPageSize}
          onPreviewListPageSizeChange={handlePreviewListPageSizeChange}
          previewMissingNatPage={state.previewMissingNatPage}
          setPreviewMissingNatPage={setPageField("previewMissingNatPage")}
          previewErrorsPage={state.previewErrorsPage}
          setPreviewErrorsPage={setPageField("previewErrorsPage")}
          previewPendingPage={state.previewPendingPage}
          setPreviewPendingPage={setPageField("previewPendingPage")}
          previewAutoFixPage={state.previewAutoFixPage}
          setPreviewAutoFixPage={setPageField("previewAutoFixPage")}
          onOpenBulkNationalityModal={openBulkNationalityModal}
        />
      )}

      {state.applyResult && (
        <CustomerPriceImportAppliedPanel
          applyResult={state.applyResult}
          phase={state.phase}
          assignElapsedSec={state.assignElapsedSec}
          pendingCurrency={state.pendingCurrency}
          onPendingCurrencyChange={(currency) => patch({ pendingCurrency: currency })}
          pendingPageSize={state.pendingPageSize}
          onPendingPageSizeChange={(size) => {
            patch({ pendingPageSize: size });
            if (state.applyResult?.batchId) {
              void loadPendingList(state.applyResult.batchId, 0, size);
            } else {
              patch({ pendingPage: 0 });
            }
          }}
          pendingPage={state.pendingPage}
          pendingListRows={state.pendingListRows}
          pendingListTotal={state.pendingListTotal}
          pendingListLoading={state.pendingListLoading}
          onPendingPageChange={(page) => {
            if (!state.applyResult?.batchId) return;
            void loadPendingList(state.applyResult.batchId, page, state.pendingPageSize);
          }}
          onAssignPendingCurrency={handleAssignPendingCurrency}
          canWrite={canWrite}
        />
      )}

      <CustomerPriceImportBulkDialog
        open={state.bulkModalOpen}
        onOpenChange={(open) => patch({ bulkModalOpen: open })}
        natDrafts={state.natDrafts}
        onNatDraftsChange={(drafts) => patch({ natDrafts: drafts })}
        bulkLocalError={state.bulkLocalError}
        bulkSaving={state.bulkSaving}
        canWrite={canWrite}
        onSubmit={handleBulkCreateNationalities}
      />
    </div>
  );
}
