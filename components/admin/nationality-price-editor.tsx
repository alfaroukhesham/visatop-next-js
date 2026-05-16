"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiHref } from "@/lib/app-href";
import { formatMinorUnitsAmount } from "@/lib/pricing/format-minor-units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AdminTableLoadingFrame,
  AdminTableLoadingSkeleton,
} from "@/components/admin/admin-loading";

export type NationalityOption = {
  code: string;
  name: string;
  enabled: boolean;
};

type PricingRow = {
  serviceId: string;
  serviceName: string;
  enabled: boolean;
  displayUsdMinor: string | null;
  displayAedMinor: string | null;
  displayUsdFxDerived: boolean;
  displayAedFxDerived: boolean;
};

function formatDisplayMinor(minor: string | null, currency: "USD" | "AED", fxDerived: boolean) {
  if (!minor) return "—";
  const amount = formatMinorUnitsAmount(minor, currency);
  return fxDerived ? `${amount} (FX)` : amount;
}

export function NationalityPriceEditor({
  nationalities,
  canWrite,
}: {
  nationalities: NationalityOption[];
  canWrite: boolean;
}) {
  const [nationalityCode, setNationalityCode] = useState("");
  const [currency, setCurrency] = useState<"USD" | "AED">("USD");
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedNat = useMemo(
    () => nationalities.find((n) => n.code === nationalityCode),
    [nationalities, nationalityCode],
  );

  const loadRows = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setDrafts({});
    try {
      const res = await fetch(apiHref(`/admin/catalog/customer-prices/nationality/${code}`), {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRows([]);
        setError((data as { error?: { message?: string } })?.error?.message ?? "Failed to load prices.");
        return;
      }
      const services = (data as { data?: { services?: PricingRow[] } })?.data?.services ?? [];
      setRows(services);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!nationalityCode) {
      setRows([]);
      setDrafts({});
      return;
    }
    void loadRows(nationalityCode);
  }, [nationalityCode, loadRows]);

  async function savePrices() {
    if (!nationalityCode) return;
    const updates = rows
      .map((row) => ({
        serviceId: row.serviceId,
        amountMajor: (drafts[row.serviceId] ?? "").trim(),
      }))
      .filter((u) => u.amountMajor.length > 0);
    if (updates.length === 0) {
      setError("Enter at least one new price.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(apiHref(`/admin/catalog/customer-prices/nationality/${nationalityCode}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currency, updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: { message?: string } })?.error?.message ?? "Save failed.");
        return;
      }
      const updated = (data as { data?: { updated?: number } })?.data?.updated ?? updates.length;
      setSuccess(`Updated ${updated} service price${updated === 1 ? "" : "s"}. The other currency was filled via FX.`);
      setDrafts({});
      await loadRows(nationalityCode);
    } finally {
      setSaving(false);
    }
  }

  async function cleanupOrphans() {
    if (
      !window.confirm(
        "Remove duplicate empty services (from repeated imports), eligibility without prices, and other unused catalog rows? This cannot be undone.",
      )
    ) {
      return;
    }
    setCleaning(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(apiHref("/admin/catalog/cleanup-orphans"), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: { message?: string } })?.error?.message ?? "Cleanup failed.");
        return;
      }
      const summary = data as {
        data?: {
          eligibilityRemoved?: number;
          duplicateServicesRemoved?: number;
          unusedServicesRemoved?: number;
        };
      };
      const r = summary.data;
      const total =
        (r?.eligibilityRemoved ?? 0) +
        (r?.duplicateServicesRemoved ?? 0) +
        (r?.unusedServicesRemoved ?? 0);
      setSuccess(
        total === 0
          ? "No orphan catalog rows found."
          : `Cleanup complete: ${r?.duplicateServicesRemoved ?? 0} duplicate service(s), ${r?.eligibilityRemoved ?? 0} stray eligibility row(s), ${r?.unusedServicesRemoved ?? 0} unused service(s) removed.`,
      );
      if (nationalityCode) await loadRows(nationalityCode);
    } finally {
      setCleaning(false);
    }
  }

  return (
    <Card className="rounded-none border-border">
      <CardHeader>
        <CardTitle>Update prices for a nationality</CardTitle>
        <CardDescription>
          Choose a nationality to see services that already have a customer price for that nationality. Only rows with
          a new price are saved; the other currency is derived via FX. To add a new service, use{" "}
          <Link href="/admin/catalog" className="text-primary underline underline-offset-2">
            Catalog → Services
          </Link>
          . If you see duplicate names from repeated imports, run catalog cleanup below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="nat-price-nationality">Nationality</Label>
            <select
              id="nat-price-nationality"
              value={nationalityCode}
              onChange={(e) => setNationalityCode(e.target.value)}
              className="border-border bg-background h-9 w-full rounded-none border px-2 text-sm"
            >
              <option value="">Select nationality…</option>
              {nationalities.map((n) => (
                <option key={n.code} value={n.code} disabled={!n.enabled}>
                  {n.name} ({n.code}){!n.enabled ? " — disabled" : ""}
                </option>
              ))}
            </select>
          </div>
          {nationalityCode ? (
            <div className="space-y-2">
              <Label htmlFor="nat-price-currency">New prices in</Label>
              <select
                id="nat-price-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "USD" | "AED")}
                className="border-border bg-background h-9 w-full rounded-none border px-2 text-sm"
              >
                <option value="USD">USD</option>
                <option value="AED">AED</option>
              </select>
            </div>
          ) : null}
        </div>

        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2 border border-border bg-muted/20 p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              disabled={cleaning || saving}
              onClick={() => void cleanupOrphans()}
            >
              {cleaning ? <Loader2 className="size-4 animate-spin" /> : null}
              Clean up orphan catalog data
            </Button>
            <p className="text-muted-foreground text-xs">
              Removes duplicate empty services from old imports and eligibility rows without prices.
            </p>
          </div>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}

        {nationalityCode ? (
          rows.length === 0 && !loading ? (
            <p className="text-muted-foreground text-sm">
              No customer prices for this nationality yet. Import a price sheet or add prices in{" "}
              <Link href="/admin/catalog" className="text-primary underline underline-offset-2">
                Catalog
              </Link>
              . If duplicates appear after imports, use catalog cleanup above.
            </p>
          ) : (
            <AdminTableLoadingFrame
              loading={loading}
              hasRows={rows.length > 0}
              className="overflow-x-auto border border-border"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Current (USD)</TableHead>
                    <TableHead>Current (AED)</TableHead>
                    <TableHead className="min-w-[8rem]">New price ({currency})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && rows.length === 0 ? (
                    <AdminTableLoadingSkeleton columns={4} rows={8} />
                  ) : null}
                  {rows.map((row) => (
                    <TableRow key={row.serviceId}>
                      <TableCell>
                        <span className="font-medium">{row.serviceName}</span>
                        {!row.enabled ? (
                          <span className="text-muted-foreground ml-2 text-xs">(disabled)</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {formatDisplayMinor(row.displayUsdMinor, "USD", row.displayUsdFxDerived)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {formatDisplayMinor(row.displayAedMinor, "AED", row.displayAedFxDerived)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g. 419.00"
                          className="rounded-none font-mono text-sm"
                          disabled={!canWrite || saving}
                          value={drafts[row.serviceId] ?? ""}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [row.serviceId]: e.target.value }))
                          }
                          aria-label={`New ${currency} price for ${row.serviceName}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableLoadingFrame>
          )
        ) : null}
      </CardContent>
      {nationalityCode && rows.length > 0 ? (
        <CardFooter className="border-t border-border bg-muted/30">
          <Button
            type="button"
            className="rounded-none"
            disabled={!canWrite || saving || loading}
            onClick={() => void savePrices()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save price changes
          </Button>
          {!canWrite ? (
            <p className="text-muted-foreground ml-4 text-xs">
              Requires catalog.write and audit.write permissions.
            </p>
          ) : null}
          {selectedNat ? (
            <p className="text-muted-foreground ml-auto text-xs hidden sm:block">
              Editing: {selectedNat.name} ({selectedNat.code})
            </p>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}
