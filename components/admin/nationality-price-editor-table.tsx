"use client";

import { formatMinorUnitsAmount } from "@/lib/pricing/format-minor-units";
import { Input } from "@/components/ui/input";
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

export type NationalityPricingRow = {
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

export function NationalityPriceEditorTable({
  rows,
  drafts,
  currency,
  loading,
  canWrite,
  saving,
  onDraftChange,
}: {
  rows: NationalityPricingRow[];
  drafts: Record<string, string>;
  currency: "USD" | "AED";
  loading: boolean;
  canWrite: boolean;
  saving: boolean;
  onDraftChange: (serviceId: string, value: string) => void;
}) {
  return (
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
          {loading && rows.length === 0 ? <AdminTableLoadingSkeleton columns={4} rows={8} /> : null}
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
                  onChange={(e) => onDraftChange(row.serviceId, e.target.value)}
                  aria-label={`New ${currency} price for ${row.serviceName}`}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminTableLoadingFrame>
  );
}
