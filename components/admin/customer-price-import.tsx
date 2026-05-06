"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Upload,
  Wand2,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Types (mirror server response shapes) ───────────────────────────────────

type PreviewResult = {
  headerRowIndex: number;
  errors: { rowIdx: number; countryRaw: string; message: string }[];
  pending: {
    rowIdx: number;
    nationalityCode: string | null;
    serviceId: string | null;
    serviceName: string;
    amountMinor: string;
    rowRef: string;
  }[];
  autoFixPreview: {
    nationalityCode: string | null;
    serviceName: string;
    existingCurrency: "USD" | "AED";
    derivedCurrency: "USD" | "AED";
    fxRate: string | null;
  }[];
  unknownServices: string[];
  stats: {
    dataRows: number;
    pricedCells: number;
    ambiguousCells: number;
    emptyCells: number;
  };
};

type ApplyResult = {
  batchId: string;
  committed?: boolean;
  headerRowIndex?: number;
  partialApplied: boolean;
  rowsProcessed: number;
  skippedRows: number;
  skippedCells: number;
  pricesUpserted: number;
  pricesDeleted: number;
  pendingCreated: number;
  eligibilityAdded: number;
  eligibilityRemoved: number;
  autoFix: {
    nationalityCode: string;
    serviceId: string;
    serviceName: string;
    fixedCurrency: "USD" | "AED";
    derivedFrom: "USD" | "AED";
    fxRate: string;
  }[];
  servicesCreated: { id: string; name: string }[];
  errors: { rowIdx: number; countryRaw: string; message: string }[];
};

// ─── Component ───────────────────────────────────────────────────────────────

export function CustomerPriceImport({ canWrite }: { canWrite: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [pendingCurrency, setPendingCurrency] = useState<"USD" | "AED">("USD");
  const [phase, setPhase] = useState<"idle" | "previewing" | "previewed" | "applying" | "applied" | "assigning">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showAutoFix, setShowAutoFix] = useState(false);
  const [applyMode, setApplyMode] = useState<"strict" | "partial">("strict");

  const hasBlockingErrors =
    preview && preview.headerRowIndex === -1;
  const hasErrors = preview && preview.errors.length > 0;
  const canApply =
    !!preview &&
    !hasBlockingErrors &&
    canWrite &&
    (!hasErrors || applyMode === "partial");

  async function handlePreview() {
    if (!file) return;
    setError(null);
    setPreview(null);
    setApplyResult(null);
    setApplyMode("strict");
    setPhase("previewing");

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/catalog/customer-prices/import/preview", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Preview failed.");
        setPhase("idle");
        return;
      }
      setPreview(json.data);
      setPhase("previewed");
    } catch {
      setError("Network error during preview.");
      setPhase("idle");
    }
  }

  async function handleApply() {
    if (!file) return;
    setError(null);
    setPhase("applying");

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", applyMode);
      const res = await fetch("/api/admin/catalog/customer-prices/import/apply", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Apply failed.");
        setPhase("previewed");
        return;
      }
      setApplyResult(json.data);
      setPhase("applied");
    } catch {
      setError("Network error during apply.");
      setPhase("previewed");
    }
  }

  async function handleAssignPendingCurrency() {
    if (!applyResult?.batchId) return;
    setError(null);
    setPhase("assigning");

    try {
      const res = await fetch("/api/admin/catalog/customer-prices/import/pending-currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: pendingCurrency, batchId: applyResult.batchId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Currency assignment failed.");
        setPhase("applied");
        return;
      }
      // Refresh apply result with updated pending count
      setApplyResult((prev) =>
        prev
          ? {
              ...prev,
              pendingCreated: Math.max(0, prev.pendingCreated - (json.data?.promoted ?? 0)),
              eligibilityAdded: prev.eligibilityAdded + (json.data?.eligibilityAdded ?? 0),
            }
          : prev,
      );
      setPhase("applied");
    } catch {
      setError("Network error assigning currency.");
      setPhase("applied");
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setApplyResult(null);
    setError(null);
    setPhase("idle");
    setApplyMode("strict");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Price Sheet (XLSX)
          </CardTitle>
          <CardDescription>
            Upload the standard <code>Price_template_v01.xlsx</code> format.
            Columns: <code>#</code>, <code>Country</code>, then one column per
            visa service. Header row is auto-detected (scans first 25 rows).
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
                disabled={!canWrite || phase === "previewing" || phase === "applying"}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setPreview(null);
                  setApplyResult(null);
                  setError(null);
                  setPhase("idle");
                }}
                className="block text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-border file:text-sm file:font-medium file:cursor-pointer"
              />
            </div>
            {!canWrite && (
              <Alert>
                <Info className="h-4 w-4" />
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
            disabled={!file || phase === "previewing" || phase === "applying"}
            variant="outline"
          >
            {phase === "previewing" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Preview
          </Button>
          {preview && !hasBlockingErrors && (
            <Button
              id="btn-apply-sheet"
              onClick={handleApply}
              disabled={!canApply || phase === "applying" || phase === "applied"}
            >
              {phase === "applying" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply Import {applyMode === "partial" ? "(Partial)" : "(Strict)"}
            </Button>
          )}
          {(preview || applyResult || error) && (
            <Button variant="ghost" onClick={reset}>
              Reset
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Error banner */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Preview result */}
      {preview && phase !== "applied" && (
        <div className="space-y-4">
          {/* Stats row */}
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

          {/* Header row info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Header detected</AlertTitle>
            <AlertDescription>
              {preview.headerRowIndex === -1
                ? "❌ No valid header row found. Ensure columns '#', 'Country', and at least one service column exist in the first 25 rows."
                : `✅ Header row found at row ${preview.headerRowIndex + 1}.`}
            </AlertDescription>
          </Alert>

          {/* Unknown services */}
          {preview.unknownServices.length > 0 && (
            <Alert>
              <Wand2 className="h-4 w-4" />
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

          {/* Validation errors */}
          {preview.errors.length > 0 && (
            <Card className="border-destructive">
              <CardHeader className="pb-2">
                <CardTitle className="text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
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
                        onClick={() => setApplyMode("strict")}
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
                        onClick={() => setApplyMode("partial")}
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
                    {preview.errors.map((e) => (
                      <TableRow key={`${e.rowIdx}-${e.countryRaw}`}>
                        <TableCell>{e.rowIdx}</TableCell>
                        <TableCell>{e.countryRaw || "—"}</TableCell>
                        <TableCell className="text-destructive text-sm">{e.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Pending currency rows */}
          {preview.pending.length > 0 && (
            <Card className="border-amber-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-500" />
                  {preview.pending.length} amount(s) without currency — will go to pending wizard after apply
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
                    {preview.pending.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{p.rowIdx}</TableCell>
                        <TableCell>{p.serviceName}</TableCell>
                        <TableCell className="tabular-nums">{p.amountMinor}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{p.rowRef}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* FX auto-fix preview */}
          {preview.autoFixPreview.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setShowAutoFix((v) => !v)}
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-blue-500" />
                    {preview.autoFixPreview.length} FX auto-fill(s) will be applied
                  </CardTitle>
                  {showAutoFix ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                      {preview.autoFixPreview.map((f, i) => (
                        <TableRow key={i}>
                          <TableCell>{f.nationalityCode ?? "—"}</TableCell>
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
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Apply result */}
      {applyResult && (
        <div className="space-y-4">
          <Alert className="border-green-500/50">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle>Import applied successfully</AlertTitle>
            <AlertDescription className="grid grid-cols-2 gap-1 text-sm mt-2">
              <span>Mode:</span><span className="font-medium">{applyResult.partialApplied ? "Partial" : "Strict"}</span>
              <span>Rows processed:</span><span className="font-medium">{applyResult.rowsProcessed}</span>
              <span>Rows skipped:</span><span className="font-medium">{applyResult.skippedRows}</span>
              <span>Prices upserted:</span><span className="font-medium">{applyResult.pricesUpserted}</span>
              <span>Prices deleted:</span><span className="font-medium">{applyResult.pricesDeleted}</span>
              <span>Pending rows:</span><span className="font-medium">{applyResult.pendingCreated}</span>
              <span>Eligibility added:</span><span className="font-medium">{applyResult.eligibilityAdded}</span>
              <span>Eligibility removed:</span><span className="font-medium">{applyResult.eligibilityRemoved}</span>
            </AlertDescription>
          </Alert>

          {/* Auto-fix summary */}
          {applyResult.autoFix.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-blue-500" />
                  {applyResult.autoFix.length} FX-derived row(s) materialised
                </CardTitle>
                <CardDescription className="text-xs">
                  These rows were automatically created from the other currency using the configured FX rate.
                  Data integrity is your responsibility — verify these are correct.
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
                    {applyResult.autoFix.map((f, i) => (
                      <TableRow key={i}>
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

          {/* Services created */}
          {applyResult.servicesCreated.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
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

          {/* Apply errors */}
          {applyResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
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

          {/* Pending currency wizard */}
          {applyResult.pendingCreated > 0 && (
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-amber-500" />
                  Currency Wizard — {applyResult.pendingCreated} pending row(s)
                </CardTitle>
                <CardDescription className="text-xs">
                  These rows have amounts but no currency. Assign a currency to make them live.
                  The system will fill the missing sibling currency via FX auto-fill.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Assign all pending as:</span>
                  <div className="flex gap-2">
                    {(["USD", "AED"] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setPendingCurrency(c)}
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
              </CardContent>
              <CardFooter>
                <Button
                  id="btn-assign-pending-currency"
                  onClick={handleAssignPendingCurrency}
                  disabled={phase === "assigning" || !canWrite}
                >
                  {phase === "assigning" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assign {pendingCurrency} to all pending rows
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
