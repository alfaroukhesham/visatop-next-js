"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  AdminTableLoadingFrame,
  AdminTableLoadingSkeleton,
} from "@/components/admin/admin-loading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Wand2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import type {
  ApplyResult,
  ImportPhase,
  PendingImportListRow,
} from "@/components/admin/customer-price-import-types";

export type CustomerPriceImportPendingWizardProps = {
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

export function CustomerPriceImportPendingWizard({
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
}: CustomerPriceImportPendingWizardProps) {
  if (applyResult.pendingCreated <= 0) {
    return null;
  }

  return (
    <>
      {phase === "assigning" && (
        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertTitle>Assigning currency…</AlertTitle>
          <AlertDescription className="text-sm">
            Updating live prices for every pending row in this batch. This can take a moment on large imports.
            <span className="mt-1 block tabular-nums text-muted-foreground">
              Elapsed {assignElapsedSec}s
            </span>
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-amber-500/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Wand2 className="size-4 text-amber-500" />
            Currency wizard ,  {applyResult.pendingCreated} pending row
            {applyResult.pendingCreated === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription className="text-xs">
            Review the rows below, choose which currency the stored amounts represent, then assign once for the
            whole batch. The other currency is filled automatically from your FX rate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="pending-page-size" className="text-sm whitespace-nowrap">
                Rows per page
              </Label>
              <select
                id="pending-page-size"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={pendingPageSize}
                onChange={(e) => onPendingPageSizeChange(Number(e.target.value))}
                disabled={phase === "assigning"}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Amounts are in:</span>
              <div className="flex gap-2">
                {(["USD", "AED"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onPendingCurrencyChange(c)}
                    disabled={phase === "assigning"}
                    className={`px-3 py-1 rounded border text-sm font-medium transition-colors ${
                      pendingCurrency === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <AdminTableLoadingFrame
            loading={pendingListLoading}
            hasRows={pendingListRows.length > 0}
            className="rounded-md border overflow-x-auto"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Nationality</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Amount (minor)</TableHead>
                  <TableHead className="min-w-[120px]">Sheet ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingListLoading && pendingListRows.length === 0 ? (
                  <AdminTableLoadingSkeleton
                    rows={Math.min(pendingPageSize, 8)}
                    columns={4}
                    columnWidths={["w-16", "w-2/5", "w-20", "w-24"]}
                  />
                ) : pendingListRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground py-6 text-center text-sm">
                      No rows on this page. Try another page or re-run apply if the batch changed.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingListRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.nationalityCode}</TableCell>
                      <TableCell className="text-sm">{r.serviceName}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{r.amountMinor}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.rowRef ?? ", "}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </AdminTableLoadingFrame>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
            <span className="tabular-nums inline-flex items-center gap-2">
              {pendingListLoading ? (
                <Loader2 className="admin-loading-spin size-3.5 shrink-0" aria-hidden />
              ) : null}
              Showing{" "}
              {pendingListTotal === 0
                ? 0
                : pendingPage * pendingPageSize + 1}
              –
              {Math.min(pendingListTotal, (pendingPage + 1) * pendingPageSize)} of {pendingListTotal}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  phase === "assigning" || pendingPage <= 0 || pendingListLoading
                }
                onClick={() => onPendingPageChange(Math.max(0, pendingPage - 1))}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  phase === "assigning" ||
                  pendingListLoading ||
                  (pendingPage + 1) * pendingPageSize >= pendingListTotal
                }
                onClick={() => onPendingPageChange(pendingPage + 1)}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
          <Button
            id="btn-assign-pending-currency"
            onClick={onAssignPendingCurrency}
            disabled={phase === "assigning" || !canWrite || applyResult.pendingCreated <= 0}
          >
            {phase === "assigning" && <Loader2 className="mr-2 size-4 animate-spin" />}
            Assign {pendingCurrency} to all {applyResult.pendingCreated} pending row
            {applyResult.pendingCreated === 1 ? "" : "s"}
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
