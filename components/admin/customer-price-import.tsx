"use client";

import { useState, useRef, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { apiHref } from "@/lib/app-href";
import { normalizeCountryName } from "@/lib/admin/catalog/parse-price-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ─── Types (mirror server response shapes) ───────────────────────────────────

type MissingNationalityEntry = {
  normKey: string;
  exampleRaw: string;
  exampleRowIdx: number;
  suggestedAlpha2?: string | null;
};

type PreviewResult = {
  headerRowIndex: number;
  missingNationalities: MissingNationalityEntry[];
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
  missingNationalities?: MissingNationalityEntry[];
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

type PendingImportListRow = {
  id: string;
  nationalityCode: string;
  serviceId: string;
  serviceName: string;
  amountMinor: string;
  rowRef: string | null;
  batchId: string;
};

type NationalityDraftRow = {
  normKey: string;
  exampleRowIdx: number;
  code: string;
  name: string;
  /** Server ISO guess for hint text (unchanged when user edits). */
  suggestedAlpha2: string | null;
};

type ListPaginatorBarProps = {
  selectId: string;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  total: number;
  disabled?: boolean;
};

function ListPaginatorBar({
  selectId,
  page,
  setPage,
  pageSize,
  onPageSizeChange,
  total,
  disabled,
}: ListPaginatorBarProps) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={selectId} className="text-xs whitespace-nowrap">
          Rows per page
        </Label>
        <select
          id={selectId}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={disabled}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <span className="tabular-nums">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || total === 0 || (page + 1) * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

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
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [natDrafts, setNatDrafts] = useState<NationalityDraftRow[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkLocalError, setBulkLocalError] = useState<string | null>(null);
  const [applyElapsedSec, setApplyElapsedSec] = useState(0);
  const [assignElapsedSec, setAssignElapsedSec] = useState(0);
  const [pendingListRows, setPendingListRows] = useState<PendingImportListRow[]>([]);
  const [pendingListTotal, setPendingListTotal] = useState(0);
  const [pendingListLoading, setPendingListLoading] = useState(false);
  const [pendingPage, setPendingPage] = useState(0);
  const [pendingPageSize, setPendingPageSize] = useState(25);
  /** Shared page size for preview tables (matches currency wizard options). */
  const [previewListPageSize, setPreviewListPageSize] = useState(25);
  const [previewPendingPage, setPreviewPendingPage] = useState(0);
  const [previewErrorsPage, setPreviewErrorsPage] = useState(0);
  const [previewMissingNatPage, setPreviewMissingNatPage] = useState(0);
  const [previewAutoFixPage, setPreviewAutoFixPage] = useState(0);

  useEffect(() => {
    if (phase !== "applying") return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setApplyElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "assigning") return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setAssignElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const batchId = applyResult?.batchId;
    const pendingCount = applyResult?.pendingCreated ?? 0;
    if (!batchId || pendingCount <= 0) {
      setPendingListRows([]);
      setPendingListTotal(0);
      return;
    }

    let cancelled = false;
    const offset = pendingPage * pendingPageSize;

    void (async () => {
      setPendingListLoading(true);
      try {
        const qs = new URLSearchParams({
          batchId,
          limit: String(pendingPageSize),
          offset: String(offset),
        });
        const res = await fetch(
          `${apiHref("admin/catalog/customer-prices/import/pending-currency")}?${qs}`,
        );
        const json = await res.json();
        if (!res.ok || cancelled) {
          if (!cancelled) {
            setPendingListRows([]);
            setPendingListTotal(0);
          }
          return;
        }
        const data = json.data as { rows: PendingImportListRow[]; total: number };
        if (cancelled) return;
        const total = typeof data.total === "number" ? data.total : 0;
        if (total > 0 && offset >= total) {
          const lastPage = Math.max(0, Math.ceil(total / pendingPageSize) - 1);
          if (lastPage !== pendingPage) {
            setPendingPage(lastPage);
            return;
          }
        }
        setPendingListRows(Array.isArray(data.rows) ? data.rows : []);
        setPendingListTotal(total);
      } catch {
        if (!cancelled) {
          setPendingListRows([]);
          setPendingListTotal(0);
        }
      } finally {
        if (!cancelled) setPendingListLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyResult?.batchId, applyResult?.pendingCreated, pendingPage, pendingPageSize]);

  useEffect(() => {
    setPreviewPendingPage(0);
    setPreviewErrorsPage(0);
    setPreviewMissingNatPage(0);
    setPreviewAutoFixPage(0);
  }, [previewListPageSize]);

  useEffect(() => {
    if (!preview) return;
    setPreviewPendingPage(0);
    setPreviewErrorsPage(0);
    setPreviewMissingNatPage(0);
    setPreviewAutoFixPage(0);
  }, [preview]);

  const previewSlices = useMemo(() => {
    if (!preview) {
      return {
        missing: [] as PreviewResult["missingNationalities"],
        errors: [] as PreviewResult["errors"],
        pending: [] as PreviewResult["pending"],
        autoFix: [] as PreviewResult["autoFixPreview"],
      };
    }
    const ps = previewListPageSize;
    const slice = <T,>(arr: T[], page: number) => arr.slice(page * ps, page * ps + ps);
    return {
      missing: slice(preview.missingNationalities, previewMissingNatPage),
      errors: slice(preview.errors, previewErrorsPage),
      pending: slice(preview.pending, previewPendingPage),
      autoFix: slice(preview.autoFixPreview, previewAutoFixPage),
    };
  }, [
    preview,
    previewListPageSize,
    previewMissingNatPage,
    previewErrorsPage,
    previewPendingPage,
    previewAutoFixPage,
  ]);

  const hasBlockingErrors =
    preview && preview.headerRowIndex === -1;
  const hasErrors = preview && preview.errors.length > 0;
  const missingNationalities = preview?.missingNationalities ?? [];
  const hasMissingNationalities = missingNationalities.length > 0;
  const canApply =
    !!preview &&
    !hasBlockingErrors &&
    !hasMissingNationalities &&
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
      const body = await file.arrayBuffer();
      const res = await fetch(apiHref("admin/catalog/customer-prices/import/preview"), {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Preview failed.");
        setPhase("idle");
        return;
      }
      const data = json.data as PreviewResult;
      setPreview({
        ...data,
        missingNationalities: data.missingNationalities ?? [],
      });
      setPhase("previewed");
    } catch {
      setError("Network error during preview.");
      setPhase("idle");
    }
  }

  async function handleApply() {
    if (!file) return;
    setError(null);
    setApplyElapsedSec(0);
    setPhase("applying");

    try {
      const body = await file.arrayBuffer();
      const res = await fetch(apiHref("admin/catalog/customer-prices/import/apply"), {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Import-Mode": applyMode,
        },
        body,
      });
      const json = await res.json();
      if (!res.ok) {
        const details = json?.error?.details as { missingNationalities?: MissingNationalityEntry[] } | undefined;
        if (details?.missingNationalities?.length) {
          setError(
            `${json?.error?.message ?? "Apply blocked."} Open “Create nationalities” below to add ${details.missingNationalities.length} missing entr${details.missingNationalities.length === 1 ? "y" : "ies"}.`,
          );
        } else {
          setError(json?.error?.message ?? "Apply failed.");
        }
        setPhase("previewed");
        return;
      }
      setApplyResult(json.data);
      setPendingPage(0);
      setPendingPageSize(previewListPageSize);
      setPhase("applied");
    } catch {
      setError("Network error during apply.");
      setPhase("previewed");
    }
  }

  async function handleAssignPendingCurrency() {
    if (!applyResult?.batchId) return;
    setError(null);
    setAssignElapsedSec(0);
    setPhase("assigning");

    try {
      const res = await fetch(apiHref("admin/catalog/customer-prices/import/pending-currency"), {
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
    setBulkModalOpen(false);
    setNatDrafts([]);
    setBulkLocalError(null);
    setPendingPage(0);
    setPendingPageSize(25);
    setPreviewListPageSize(25);
    setPreviewPendingPage(0);
    setPreviewErrorsPage(0);
    setPreviewMissingNatPage(0);
    setPreviewAutoFixPage(0);
    setPendingListRows([]);
    setPendingListTotal(0);
    setAssignElapsedSec(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  function openBulkNationalityModal() {
    if (!preview?.missingNationalities?.length) return;
    setNatDrafts(
      preview.missingNationalities.map((m) => ({
        normKey: m.normKey,
        exampleRowIdx: m.exampleRowIdx,
        code: m.suggestedAlpha2 ?? "",
        name: m.exampleRaw,
        suggestedAlpha2: m.suggestedAlpha2 ?? null,
      })),
    );
    setBulkLocalError(null);
    setBulkModalOpen(true);
  }

  async function handleBulkCreateNationalities() {
    setBulkLocalError(null);
    const codeRe = /^[A-Za-z]{2}$/;
    const seenCodes = new Set<string>();
    const seenNormNames = new Map<string, string>();
    for (const d of natDrafts) {
      const code = d.code.trim().toUpperCase();
      const name = d.name.trim();
      if (!codeRe.test(code)) {
        setBulkLocalError(`Row “${name}”: ISO code must be exactly two letters (e.g. AE).`);
        return;
      }
      if (!name) {
        setBulkLocalError("Every nationality needs a display name.");
        return;
      }
      if (seenCodes.has(code)) {
        setBulkLocalError(`Duplicate ISO code in this list: ${code}.`);
        return;
      }
      seenCodes.add(code);
      const nk = normalizeCountryName(name);
      const prev = seenNormNames.get(nk);
      if (prev !== undefined && prev !== code) {
        setBulkLocalError(`Duplicate display name after normalisation: “${name}”.`);
        return;
      }
      seenNormNames.set(nk, code);
    }

    setBulkSaving(true);
    try {
      const res = await fetch(apiHref("admin/catalog/nationalities/bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: natDrafts.map((d) => ({
            code: d.code.trim().toUpperCase(),
            name: d.name.trim(),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBulkLocalError(json?.error?.message ?? "Bulk create failed.");
        setBulkSaving(false);
        return;
      }
      setBulkModalOpen(false);
      setNatDrafts([]);
      setBulkSaving(false);
      if (file) {
        setError(null);
        setApplyResult(null);
        setPhase("previewing");
        try {
          const body = await file.arrayBuffer();
          const previewRes = await fetch(apiHref("admin/catalog/customer-prices/import/preview"), {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body,
          });
          const previewJson = await previewRes.json();
          if (!previewRes.ok) {
            setError(previewJson?.error?.message ?? "Preview failed after creating nationalities.");
            setPhase("idle");
            return;
          }
          const data = previewJson.data as PreviewResult;
          setPreview({
            ...data,
            missingNationalities: data.missingNationalities ?? [],
          });
          setPhase("previewed");
        } catch {
          setError("Network error re-running preview.");
          setPhase("idle");
        }
      }
    } catch {
      setBulkLocalError("Network error during bulk create.");
      setBulkSaving(false);
    }
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

      {phase === "applying" && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Applying import…</AlertTitle>
          <AlertDescription className="text-sm">
            Large sheets can take a minute or more. This request runs entirely on the server; do not close the tab.
            <span className="mt-1 block tabular-nums text-muted-foreground">
              Elapsed {applyElapsedSec}s
            </span>
          </AlertDescription>
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

          {hasMissingNationalities && (
            <Card className="border-amber-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-600" />
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
                            <span className="text-muted-foreground text-xs">—</span>
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
                  onPageSizeChange={setPreviewListPageSize}
                  total={missingNationalities.length}
                  disabled={phase === "applying" || phase === "assigning"}
                />
                <Button type="button" variant="secondary" onClick={openBulkNationalityModal} disabled={!canWrite}>
                  Create nationalities…
                </Button>
              </CardContent>
            </Card>
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
                    {previewSlices.errors.map((e) => (
                      <TableRow key={`${e.rowIdx}-${e.countryRaw}-${e.message.slice(0, 24)}`}>
                        <TableCell>{e.rowIdx}</TableCell>
                        <TableCell>{e.countryRaw || "—"}</TableCell>
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
                  onPageSizeChange={setPreviewListPageSize}
                  total={preview.errors.length}
                  disabled={phase === "applying" || phase === "assigning"}
                />
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
                  onPageSizeChange={setPreviewListPageSize}
                  total={preview.pending.length}
                  disabled={phase === "applying" || phase === "assigning"}
                />
              </CardContent>
            </Card>
          )}

          {/* FX auto-fix preview */}
          {preview.autoFixPreview.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <button
                  type="button"
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
                      {previewSlices.autoFix.map((f, i) => (
                        <TableRow key={`${f.nationalityCode ?? ""}-${f.serviceName}-${previewAutoFixPage * previewListPageSize + i}`}>
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
                  <ListPaginatorBar
                    selectId="preview-autofix-page-size"
                    page={previewAutoFixPage}
                    setPage={setPreviewAutoFixPage}
                    pageSize={previewListPageSize}
                    onPageSizeChange={setPreviewListPageSize}
                    total={preview.autoFixPreview.length}
                    disabled={phase === "applying" || phase === "assigning"}
                  />
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Apply result */}
      {applyResult && (
        <div className="space-y-4">
          {phase === "assigning" && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Assigning currency…</AlertTitle>
              <AlertDescription className="text-sm">
                Updating live prices for every pending row in this batch. This can take a moment on large imports.
                <span className="mt-1 block tabular-nums text-muted-foreground">
                  Elapsed {assignElapsedSec}s
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Currency wizard first when pending amounts need a currency */}
          {applyResult.pendingCreated > 0 && (
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-amber-500" />
                  Currency wizard — {applyResult.pendingCreated} pending row
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
                      onChange={(e) => {
                        setPendingPageSize(Number(e.target.value));
                        setPendingPage(0);
                      }}
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
                          onClick={() => setPendingCurrency(c)}
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

                <div className="rounded-md border overflow-x-auto">
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
                        <TableRow>
                          <TableCell colSpan={4} className="text-muted-foreground py-8 text-center text-sm">
                            <Loader2 className="inline h-4 w-4 animate-spin mr-2 align-text-bottom" />
                            Loading pending rows…
                          </TableCell>
                        </TableRow>
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
                            <TableCell className="text-muted-foreground text-xs">{r.rowRef ?? "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
                  <span className="tabular-nums">
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
                      onClick={() => setPendingPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
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
                      onClick={() => setPendingPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                <Button
                  id="btn-assign-pending-currency"
                  onClick={handleAssignPendingCurrency}
                  disabled={phase === "assigning" || !canWrite || applyResult.pendingCreated <= 0}
                >
                  {phase === "assigning" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assign {pendingCurrency} to all {applyResult.pendingCreated} pending row
                  {applyResult.pendingCreated === 1 ? "" : "s"}
                </Button>
              </CardFooter>
            </Card>
          )}

          <Alert
            className={
              applyResult.pendingCreated > 0
                ? "border-muted bg-muted/30"
                : "border-green-500/50"
            }
          >
            <CheckCircle2
              className={`h-4 w-4 ${applyResult.pendingCreated > 0 ? "text-muted-foreground" : "text-green-500"}`}
            />
            <AlertTitle>
              {applyResult.pendingCreated > 0
                ? "Import applied — finish the currency step above"
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
        </div>
      )}

      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="flex max-h-[min(85vh,720px)] flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton>
          <div className="p-4 pb-0">
            <DialogHeader>
              <DialogTitle>Bulk create nationalities</DialogTitle>
              <DialogDescription>
                ISO 3166-1 alpha-2 codes are prefilled from the official English country list (same codes as IBAN
                country prefix) plus a few common abbreviations. Display names start as the sheet cell — adjust if you
                want the catalog spelling. Codes and normalised names must be unique; the server rejects names that
                already map to a different code.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border-y px-4 py-3">
            {bulkLocalError && (
              <Alert variant="destructive" className="mb-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Cannot submit</AlertTitle>
                <AlertDescription>{bulkLocalError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              {(() => {
                const prefilled = natDrafts.filter((d) => d.suggestedAlpha2).length;
                if (prefilled === 0) return null;
                return (
                  <p className="text-xs text-muted-foreground">
                    {prefilled} of {natDrafts.length} ISO code{prefilled === 1 ? "" : "s"} prefilled — review especially
                    where the sheet label is informal or ambiguous.
                  </p>
                );
              })()}
              {natDrafts.map((row, idx) => (
                <div
                  key={row.normKey}
                  className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[auto_1fr_1fr]"
                >
                  <div className="text-xs text-muted-foreground sm:pt-2">
                    Sheet row <span className="font-medium text-foreground">{row.exampleRowIdx}</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`nat-name-${idx}`}>Display name</Label>
                    <Input
                      id={`nat-name-${idx}`}
                      value={row.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNatDrafts((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, name: v } : r)),
                        );
                      }}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`nat-code-${idx}`}>ISO code (2 letters)</Label>
                    <Input
                      id={`nat-code-${idx}`}
                      value={row.code}
                      onChange={(e) => {
                        const v = e.target.value.slice(0, 2);
                        setNatDrafts((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, code: v } : r)),
                        );
                      }}
                      maxLength={2}
                      className="uppercase font-mono"
                      autoComplete="off"
                      placeholder={row.suggestedAlpha2 ? row.suggestedAlpha2 : "e.g. AE"}
                    />
                    {row.suggestedAlpha2 ? (
                      <p className="text-xs text-muted-foreground">
                        Suggested: <span className="font-mono text-foreground">{row.suggestedAlpha2}</span>
                        {row.code.trim().toUpperCase() !== row.suggestedAlpha2 ? " (you changed it)" : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No automatic match — enter the ISO code manually.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="rounded-b-xl border-0 bg-muted/40 p-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setBulkModalOpen(false)} disabled={bulkSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleBulkCreateNationalities} disabled={bulkSaving || !canWrite}>
              {bulkSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create {natDrafts.length} nationalit{natDrafts.length === 1 ? "y" : "ies"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
