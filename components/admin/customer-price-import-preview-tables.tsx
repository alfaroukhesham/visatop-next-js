"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Wand2,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ListPaginatorBar } from "@/components/admin/customer-price-import-paginator";
import type {
  ImportPhase,
  PreviewResult,
  PreviewSlices,
} from "@/components/admin/customer-price-import-types";

export type CustomerPriceImportPreviewTablesProps = {
  preview: PreviewResult;
  phase: ImportPhase;
  previewSlices: PreviewSlices;
  missingNationalities: PreviewResult["missingNationalities"];
  hasMissingNationalities: boolean;
  canWrite: boolean;
  applyMode: "strict" | "partial";
  onApplyModeChange: (mode: "strict" | "partial") => void;
  showAutoFix: boolean;
  onToggleAutoFix: () => void;
  previewListPageSize: number;
  onPreviewListPageSizeChange: (size: number) => void;
  previewMissingNatPage: number;
  setPreviewMissingNatPage: Dispatch<SetStateAction<number>>;
  previewErrorsPage: number;
  setPreviewErrorsPage: Dispatch<SetStateAction<number>>;
  previewPendingPage: number;
  setPreviewPendingPage: Dispatch<SetStateAction<number>>;
  previewAutoFixPage: number;
  setPreviewAutoFixPage: Dispatch<SetStateAction<number>>;
  onOpenBulkNationalityModal: () => void;
};

export function CustomerPriceImportPreviewTables({
  preview,
  phase,
  previewSlices,
  missingNationalities,
  hasMissingNationalities,
  canWrite,
  applyMode,
  onApplyModeChange,
  showAutoFix,
  onToggleAutoFix,
  previewListPageSize,
  onPreviewListPageSizeChange,
  previewMissingNatPage,
  setPreviewMissingNatPage,
  previewErrorsPage,
  setPreviewErrorsPage,
  previewPendingPage,
  setPreviewPendingPage,
  previewAutoFixPage,
  setPreviewAutoFixPage,
  onOpenBulkNationalityModal,
}: CustomerPriceImportPreviewTablesProps) {
  const paginatorDisabled = phase === "applying" || phase === "assigning";

  return (
    <>
      {hasMissingNationalities && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="size-4 text-amber-600" />
              {missingNationalities.length} sheet{" "}
              {missingNationalities.length === 1 ? "country" : "countries"} not in the nationality catalog
            </CardTitle>
            <CardDescription className="text-xs">
              Apply is disabled until each country has a unique ISO 3166-1 alpha-2 code (same codes as IBAN
              country prefix) and display name in the catalog. The bulk-create dialog prefills codes from the
              official English dataset where possible; always verify.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Example row</TableHead>
                  <TableHead>Country (sheet)</TableHead>
                  <TableHead>Suggested ISO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewSlices.missing.map((m) => (
                  <TableRow key={m.normKey}>
                    <TableCell className="tabular-nums">{m.exampleRowIdx}</TableCell>
                    <TableCell>{m.exampleRaw}</TableCell>
                    <TableCell>
                      {m.suggestedAlpha2 ? (
                        <Badge variant="secondary" className="font-mono">
                          {m.suggestedAlpha2}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">, </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPaginatorBar
              selectId="preview-missing-nat-page-size"
              page={previewMissingNatPage}
              setPage={setPreviewMissingNatPage}
              pageSize={previewListPageSize}
              onPageSizeChange={onPreviewListPageSizeChange}
              total={missingNationalities.length}
              disabled={paginatorDisabled}
            />
            <Button type="button" variant="secondary" onClick={onOpenBulkNationalityModal} disabled={!canWrite}>
              Create nationalities…
            </Button>
          </CardContent>
        </Card>
      )}

      {preview.errors.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="size-4" />
              {preview.errors.length} validation error(s)
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Strict apply (default) performs <strong>zero writes</strong> when errors exist.
              To proceed anyway, you must explicitly choose Partial apply (guarded: rows with errors are skipped and empty-cell deletes are disabled for those rows).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canWrite && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <span className="text-sm font-medium">Apply mode:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onApplyModeChange("strict")}
                    className={`px-3 py-1 rounded border text-sm font-medium transition-colors ${
                      applyMode === "strict"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    Strict (default)
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyModeChange("partial")}
                    className={`px-3 py-1 rounded border text-sm font-medium transition-colors ${
                      applyMode === "partial"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    Partial (explicit)
                  </button>
                </div>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Issue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewSlices.errors.map((e) => (
                  <TableRow key={`${e.rowIdx}-${e.countryRaw}-${e.message.slice(0, 24)}`}>
                    <TableCell>{e.rowIdx}</TableCell>
                    <TableCell>{e.countryRaw || ", "}</TableCell>
                    <TableCell className="text-destructive text-sm">{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPaginatorBar
              selectId="preview-errors-page-size"
              page={previewErrorsPage}
              setPage={setPreviewErrorsPage}
              pageSize={previewListPageSize}
              onPageSizeChange={onPreviewListPageSizeChange}
              total={preview.errors.length}
              disabled={paginatorDisabled}
            />
          </CardContent>
        </Card>
      )}

      {preview.pending.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="size-4 text-amber-500" />
              {preview.pending.length} amount(s) without currency ,  will go to pending wizard after apply
            </CardTitle>
            <CardDescription className="text-xs">
              These cells had a numeric amount but no currency signal (USD, AED, $, etc.).
              They will be stored as pending and assigned a currency after apply.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Amount (minor)</TableHead>
                  <TableHead>Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewSlices.pending.map((p) => (
                  <TableRow key={`${p.rowIdx}-${p.rowRef}`}>
                    <TableCell>{p.rowIdx}</TableCell>
                    <TableCell>{p.serviceName}</TableCell>
                    <TableCell className="tabular-nums">{p.amountMinor}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{p.rowRef}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPaginatorBar
              selectId="preview-pending-page-size"
              page={previewPendingPage}
              setPage={setPreviewPendingPage}
              pageSize={previewListPageSize}
              onPageSizeChange={onPreviewListPageSizeChange}
              total={preview.pending.length}
              disabled={paginatorDisabled}
            />
          </CardContent>
        </Card>
      )}

      {preview.autoFixPreview.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <button
              type="button"
              className="flex items-center justify-between w-full text-left"
              onClick={onToggleAutoFix}
            >
              <CardTitle className="text-sm flex items-center gap-2">
                <Wand2 className="size-4 text-blue-500" />
                {preview.autoFixPreview.length} FX auto-fill(s) will be applied
              </CardTitle>
              {showAutoFix ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            <CardDescription className="text-xs mt-1">
              When only one currency is in the sheet, the system fills the other via{" "}
              <code>NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD</code>.
            </CardDescription>
          </CardHeader>
          {showAutoFix && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Existing</TableHead>
                    <TableHead>Derived</TableHead>
                    <TableHead>FX Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewSlices.autoFix.map((f, i) => (
                    <TableRow key={`${f.nationalityCode ?? ""}-${f.serviceName}-${previewAutoFixPage * previewListPageSize + i}`}>
                      <TableCell>{f.nationalityCode ?? ", "}</TableCell>
                      <TableCell>{f.serviceName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{f.existingCurrency}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{f.derivedCurrency} (auto)</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {f.fxRate ?? "⚠ Rate not configured"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ListPaginatorBar
                selectId="preview-autofix-page-size"
                page={previewAutoFixPage}
                setPage={setPreviewAutoFixPage}
                pageSize={previewListPageSize}
                onPageSizeChange={onPreviewListPageSizeChange}
                total={preview.autoFixPreview.length}
                disabled={paginatorDisabled}
              />
            </CardContent>
          )}
        </Card>
      )}
    </>
  );
}
