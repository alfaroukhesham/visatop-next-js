"use client";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle2,
  Wand2,
  Info,
} from "lucide-react";
import type { ApplyResult } from "@/components/admin/customer-price-import-types";

export type CustomerPriceImportApplySummaryProps = {
  applyResult: ApplyResult;
};

export function CustomerPriceImportApplySummary({
  applyResult,
}: CustomerPriceImportApplySummaryProps) {
  return (
    <>
      <Alert
        className={
          applyResult.pendingCreated > 0
            ? "border-muted bg-muted/30"
            : "border-green-500/50"
        }
      >
        <CheckCircle2
          className={`size-4 ${applyResult.pendingCreated > 0 ? "text-muted-foreground" : "text-green-500"}`}
        />
        <AlertTitle>
          {applyResult.unchanged
            ? "Import skipped — catalog already matches this sheet"
            : applyResult.pendingCreated > 0
              ? "Import applied ,  finish the currency step above"
              : "Import applied successfully"}
        </AlertTitle>
        <AlertDescription
          className={
            applyResult.pendingCreated > 0 ? "text-sm mt-2 space-y-1" : "grid grid-cols-2 gap-1 text-sm mt-2"
          }
        >
          {applyResult.pendingCreated > 0 ? (
            <p className="text-muted-foreground">
              Mode {applyResult.partialApplied ? "Partial" : "Strict"} · {applyResult.rowsProcessed} data rows ·{" "}
              {applyResult.pricesUpserted} prices upserted · {applyResult.pricesDeleted} cleared ·{" "}
              {applyResult.pendingCreated} still pending currency · eligibility +{applyResult.eligibilityAdded} / −
              {applyResult.eligibilityRemoved}. Details below.
            </p>
          ) : (
            <>
              <span>Mode:</span>
              <span className="font-medium">{applyResult.partialApplied ? "Partial" : "Strict"}</span>
              <span>Catalog scope:</span>
              <span className="font-medium">
                {applyResult.catalogScope === "merge" ? "Merge" : "Replace"}
              </span>
              <span>Rows processed:</span>
              <span className="font-medium">{applyResult.rowsProcessed}</span>
              <span>Rows skipped:</span>
              <span className="font-medium">{applyResult.skippedRows}</span>
              <span>Prices upserted:</span>
              <span className="font-medium">{applyResult.pricesUpserted}</span>
              <span>Prices deleted:</span>
              <span className="font-medium">{applyResult.pricesDeleted}</span>
              <span>Pending rows:</span>
              <span className="font-medium">{applyResult.pendingCreated}</span>
              <span>Eligibility added:</span>
              <span className="font-medium">{applyResult.eligibilityAdded}</span>
              <span>Eligibility removed:</span>
              <span className="font-medium">{applyResult.eligibilityRemoved}</span>
            </>
          )}
        </AlertDescription>
      </Alert>

      {applyResult.autoFix.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wand2 className="size-4 text-blue-500" />
              {applyResult.autoFix.length} FX-derived row(s) materialised
            </CardTitle>
            <CardDescription className="text-xs">
              These rows were automatically created from the other currency using the configured FX rate.
              Data integrity is your responsibility ,  verify these are correct.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Derived</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applyResult.autoFix.map((f) => (
                  <TableRow key={`${f.nationalityCode ?? "na"}:${f.serviceId}:${f.fixedCurrency}`}>
                    <TableCell>{f.nationalityCode}</TableCell>
                    <TableCell>{f.serviceName}</TableCell>
                    <TableCell><Badge>{f.fixedCurrency}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{f.derivedFrom}</Badge></TableCell>
                    <TableCell className="tabular-nums text-xs">{f.fxRate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {applyResult.servicesCreated.length > 0 && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>New services created</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc list-inside text-sm">
              {applyResult.servicesCreated.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {applyResult.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{applyResult.errors.length} row(s) skipped due to errors</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc list-inside text-sm">
              {applyResult.errors.map((e) => (
                <li key={e.rowIdx}>
                  Row {e.rowIdx} ({e.countryRaw}): {e.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
