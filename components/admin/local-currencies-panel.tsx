"use client";

import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import { formatMinorUnitsAmount } from "@/lib/pricing/format-minor-units";
import type { CatalogLocalCurrency, CatalogNationality } from "@/lib/admin/catalog/catalog-types";

interface ILocalCurrenciesPanelProps {
  localCurrencies: CatalogLocalCurrency[];
  nationalities: CatalogNationality[];
  canWrite: boolean;
}

type TPriceRow = {
  serviceId: string;
  serviceName: string;
  enabled: boolean;
  usdMinor: string | null;
  aedMinor: string | null;
  localMinor: string | null;
};

const formatMinor = (minor: string | null, currency: string): string =>
  minor ? formatMinorUnitsAmount(minor, currency) : "—";

export const LocalCurrenciesPanel: FC<ILocalCurrenciesPanelProps> = ({
  localCurrencies,
  nationalities,
  canWrite,
}) => {
  const router = useRouter();
  const [selectedCode, setSelectedCode] = useState(localCurrencies[0]?.code ?? "");
  const selected = localCurrencies.find((c) => c.code === selectedCode) ?? null;
  const [createCode, setCreateCode] = useState("");
  const [createNationalities, setCreateNationalities] = useState<string[]>([]);
  const [editNationalities, setEditNationalities] = useState<string[]>([]);
  const [priceNationality, setPriceNationality] = useState("");
  const [rows, setRows] = useState<TPriceRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = (text: string, err = false) => {
    setBanner({ type: err ? "err" : "ok", text });
    setTimeout(() => setBanner(null), 4000);
  };

  useEffect(() => {
    if (selected) {
      setEditNationalities(selected.nationalityCodes);
      setPriceNationality((current) =>
        selected.nationalityCodes.includes(current) ? current : (selected.nationalityCodes[0] ?? ""),
      );
    }
  }, [selected]);

  const loadPrices = useCallback(async (code: string, nationality: string) => {
    if (!code || !nationality) {
      setRows([]);
      return;
    }
    setLoadingPrices(true);
    try {
      const res = await fetchApiEnvelope<{ rows: TPriceRow[] }>(
        apiHref(
          `/admin/catalog/local-currencies/${encodeURIComponent(code)}/prices?nationality=${encodeURIComponent(nationality)}`,
        ),
      );
      if (!res.ok) {
        setBanner({ type: "err", text: res.error.message });
        setRows([]);
        return;
      }
      setRows(res.data.rows);
      setDrafts({});
    } finally {
      setLoadingPrices(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCode || !priceNationality) return;
    void loadPrices(selectedCode, priceNationality);
  }, [selectedCode, priceNationality, loadPrices]);

  const toggleCode = (list: string[], code: string): string[] =>
    list.includes(code) ? list.filter((c) => c !== code) : [...list, code];

  const onCreate = async () => {
    setSaving(true);
    const res = await fetchApiEnvelope<{ localCurrency: CatalogLocalCurrency }>(
      apiHref("/admin/catalog/local-currencies"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: createCode,
          nationalityCodes: createNationalities,
        }),
      },
    );
    setSaving(false);
    if (!res.ok) {
      flash(res.error.message, true);
      return;
    }
    setCreateCode("");
    setCreateNationalities([]);
    setSelectedCode(res.data.localCurrency.code);
    flash(`Created ${res.data.localCurrency.code}.`);
    router.refresh();
  };

  const onSaveLinks = async () => {
    if (!selected) return;
    setSaving(true);
    const res = await fetchApiEnvelope<{ localCurrency: CatalogLocalCurrency }>(
      apiHref(`/admin/catalog/local-currencies/${encodeURIComponent(selected.code)}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationalityCodes: editNationalities }),
      },
    );
    setSaving(false);
    if (!res.ok) {
      flash(res.error.message, true);
      return;
    }
    flash(`Updated ${selected.code} nationality links.`);
    router.refresh();
  };

  const onSavePrices = async () => {
    if (!selected || !priceNationality) return;
    const updates = Object.entries(drafts)
      .filter(([, amountMajor]) => amountMajor.trim().length > 0)
      .map(([serviceId, amountMajor]) => ({ serviceId, amountMajor }));
    if (updates.length === 0) {
      flash("Enter at least one local price.", true);
      return;
    }
    setSaving(true);
    const res = await fetchApiEnvelope<{ rows: TPriceRow[] }>(
      apiHref(`/admin/catalog/local-currencies/${encodeURIComponent(selected.code)}/prices`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationalityCode: priceNationality, updates }),
      },
    );
    setSaving(false);
    if (!res.ok) {
      flash(res.error.message, true);
      return;
    }
    setRows(res.data.rows);
    setDrafts({});
    flash(`Saved ${selected.code} prices.`);
  };

  const nationalityOptions = useMemo(
    () => nationalities.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [nationalities],
  );

  return (
    <div className="space-y-6">
      {banner ? (
        <p
          className={
            banner.type === "ok"
              ? "text-sm text-foreground"
              : "text-error border-error/30 bg-error/5 rounded-xl border px-4 py-3 text-sm"
          }
          role="status"
        >
          {banner.text}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <Card className="border-border overflow-hidden border">
          <CardHeader className="border-border bg-muted/20 border-b">
            <CardTitle className="font-heading text-lg">Local currencies</CardTitle>
            <CardDescription>
              Shown only to applicants of the linked nationality. Prices are stored in minor units and never converted
              from USD/AED.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <ul className="space-y-1">
              {localCurrencies.length === 0 ? (
                <li className="text-muted-foreground text-sm">No local currencies yet.</li>
              ) : (
                localCurrencies.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => setSelectedCode(c.code)}
                      className={
                        selectedCode === c.code
                          ? "bg-secondary text-white w-full rounded-xl px-3 py-2 text-left text-sm font-semibold"
                          : "hover:border-secondary w-full rounded-xl border border-transparent px-3 py-2 text-left text-sm"
                      }
                    >
                      <span className="font-mono tracking-widest">{c.code}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {c.nationalities.map((n) => (
                          <Badge key={n.code} variant="secondary" className="font-normal">
                            {n.code} · {n.name}
                          </Badge>
                        ))}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>

            {canWrite ? (
              <div className="border-border space-y-3 border-t pt-4">
                <p className="text-sm font-medium">Add local currency</p>
                <div className="space-y-1.5">
                  <Label htmlFor="local-currency-code">ISO 4217 code</Label>
                  <Input
                    id="local-currency-code"
                    value={createCode}
                    onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                    placeholder="NGN"
                    maxLength={3}
                    autoComplete="off"
                    className="font-mono uppercase"
                  />
                </div>
                <NationalityChecklist
                  nationalities={nationalityOptions}
                  selected={createNationalities}
                  onToggle={(code) => setCreateNationalities((current) => toggleCode(current, code))}
                />
                <Button type="button" className="gap-2" disabled={saving} onClick={() => void onCreate()}>
                  <Plus className="size-4" />
                  Create
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {selected ? (
            <>
              <Card className="border-border border">
                <CardHeader>
                  <CardTitle className="font-heading text-lg">{selected.code} nationality links</CardTitle>
                  <CardDescription>
                    Applicants with these passports see the {selected.code} tab. Everyone else only sees global USD and
                    AED.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <NationalityChecklist
                    nationalities={nationalityOptions}
                    selected={editNationalities}
                    onToggle={(code) => setEditNationalities((current) => toggleCode(current, code))}
                    disabled={!canWrite || saving}
                  />
                  {canWrite ? (
                    <Button type="button" disabled={saving} onClick={() => void onSaveLinks()}>
                      Save links
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-border border">
                <CardHeader>
                  <CardTitle className="font-heading text-lg">{selected.code} prices</CardTitle>
                  <CardDescription>
                    Enter the customer total in {selected.code} (minor units stored as kobo/cents). Global USD/AED
                    columns are for reference only.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selected.nationalityCodes.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {selected.nationalityCodes.map((code) => (
                        <Button
                          key={code}
                          type="button"
                          variant={priceNationality === code ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPriceNationality(code)}
                        >
                          {code}
                        </Button>
                      ))}
                    </div>
                  ) : null}

                  <AdminTableLoadingFrame
                    loading={loadingPrices}
                    hasRows={rows.length > 0}
                    className="overflow-x-auto border border-border"
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>USD</TableHead>
                          <TableHead>AED</TableHead>
                          <TableHead className="min-w-[9rem]">{selected.code}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingPrices && rows.length === 0 ? (
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
                              {formatMinor(row.usdMinor, "USD")}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm tabular-nums">
                              {formatMinor(row.aedMinor, "AED")}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder={formatMinor(row.localMinor, selected.code)}
                                className="font-mono text-sm"
                                disabled={!canWrite || saving}
                                value={drafts[row.serviceId] ?? ""}
                                onChange={(e) =>
                                  setDrafts((current) => ({ ...current, [row.serviceId]: e.target.value }))
                                }
                                aria-label={`${selected.code} price for ${row.serviceName}`}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AdminTableLoadingFrame>
                  {canWrite ? (
                    <Button type="button" disabled={saving || loadingPrices} onClick={() => void onSavePrices()}>
                      Save {selected.code} prices
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Select or create a local currency to edit links and prices.</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface INationalityChecklistProps {
  nationalities: CatalogNationality[];
  selected: string[];
  onToggle: (code: string) => void;
  disabled?: boolean;
}

const NationalityChecklist: FC<INationalityChecklistProps> = ({
  nationalities,
  selected,
  onToggle,
  disabled = false,
}) => {
  return (
    <fieldset className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border p-3">
      <legend className="text-muted-foreground px-1 text-xs font-medium">Nationalities</legend>
      {nationalities.map((n) => (
        <label key={n.code} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-current"
            checked={selected.includes(n.code)}
            disabled={disabled}
            onChange={() => onToggle(n.code)}
          />
          <span className="font-mono text-xs tracking-widest">{n.code}</span>
          <span>{n.name}</span>
        </label>
      ))}
    </fieldset>
  );
};
