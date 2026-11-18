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
import { formatMajorFromMinor } from "@/lib/admin/catalog/service-price-fx-fill";
import { formatMinorUnitsAmount } from "@/lib/pricing/format-minor-units";
import type { CatalogLocalCurrency, CatalogNationality } from "@/lib/admin/catalog/catalog-types";
import { resolveLocalCurrencyPriceNationality } from "@/lib/admin/catalog/resolve-local-currency-price-nationality";

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

type TBanner = { type: "ok" | "err"; text: string };

const UNLINKED_NATIONALITY_MESSAGE = "Choose a nationality linked to this local currency.";

const formatMinor = (minor: string | null, currency: string): string =>
  minor ? formatMinorUnitsAmount(minor, currency) : "—";

const majorDraftsFromRows = (rows: TPriceRow[]): Record<string, string> => {
  const drafts: Record<string, string> = {};
  for (const row of rows) {
    if (!row.localMinor) continue;
    try {
      drafts[row.serviceId] = formatMajorFromMinor(BigInt(row.localMinor));
    } catch {
      /* ignore malformed stored minor units */
    }
  }
  return drafts;
};

const toggleCode = (list: string[], code: string): string[] =>
  list.includes(code) ? list.filter((c) => c !== code) : [...list, code];

export const LocalCurrenciesPanel: FC<ILocalCurrenciesPanelProps> = ({
  localCurrencies,
  nationalities,
  canWrite,
}) => {
  const router = useRouter();
  const [currencyOverrides, setCurrencyOverrides] = useState<Record<string, CatalogLocalCurrency>>({});
  const mergedCurrencies = useMemo(() => {
    const byCode = new Map(localCurrencies.map((c) => [c.code, c]));
    for (const [code, currency] of Object.entries(currencyOverrides)) {
      byCode.set(code, currency);
    }
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [localCurrencies, currencyOverrides]);
  const [selectedCode, setSelectedCode] = useState(localCurrencies[0]?.code ?? "");
  const selected = mergedCurrencies.find((c) => c.code === selectedCode) ?? null;
  const [createCode, setCreateCode] = useState("");
  const [createNationalities, setCreateNationalities] = useState<string[]>([]);
  const [priceNationalityPick, setPriceNationalityPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<TBanner | null>(null);

  const activePriceNationality = useMemo(
    () =>
      selected
        ? resolveLocalCurrencyPriceNationality(selected.nationalityCodes, priceNationalityPick)
        : "",
    [selected, priceNationalityPick],
  );

  const derivedUnlinkedBanner = useMemo((): TBanner | null => {
    if (!selected || selected.nationalityCodes.length > 0) return null;
    return { type: "err", text: UNLINKED_NATIONALITY_MESSAGE };
  }, [selected]);

  const bannerToShow = banner ?? derivedUnlinkedBanner;

  const flash = useCallback((text: string, err = false) => {
    setBanner({ type: err ? "err" : "ok", text });
    setTimeout(() => setBanner(null), 4000);
  }, []);

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
    const created = res.data.localCurrency;
    setCreateCode("");
    setCreateNationalities([]);
    setCurrencyOverrides((current) => ({ ...current, [created.code]: created }));
    setSelectedCode(created.code);
    setPriceNationalityPick(created.nationalityCodes[0] ?? "");
    flash(`Created ${created.code}.`);
    router.refresh();
  };

  const nationalityOptions = useMemo(
    () => nationalities.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [nationalities],
  );

  const linksEditorKey = selected
    ? `links:${selected.code}:${selected.nationalityCodes.join(",")}`
    : "links:none";

  return (
    <div className="space-y-6">
      {bannerToShow ? (
        <p
          className={
            bannerToShow.type === "err"
              ? "border-destructive/40 bg-destructive/10 text-destructive border-b-2 px-4 py-3 text-sm"
              : "border-success/40 bg-success/10 text-success border-b-2 px-4 py-3 text-sm"
          }
          role="status"
        >
          {bannerToShow.text}
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
              {mergedCurrencies.length === 0 ? (
                <li className="text-muted-foreground text-sm">No local currencies yet.</li>
              ) : (
                mergedCurrencies.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCode(c.code);
                        setPriceNationalityPick((current) =>
                          resolveLocalCurrencyPriceNationality(c.nationalityCodes, current),
                        );
                      }}
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
              <LocalCurrencyLinksEditor
                key={linksEditorKey}
                currency={selected}
                nationalityOptions={nationalityOptions}
                canWrite={canWrite}
                saving={saving}
                onSavingChange={setSaving}
                onFlash={flash}
                onSaved={(updated) => {
                  setCurrencyOverrides((current) => ({ ...current, [updated.code]: updated }));
                  setPriceNationalityPick((currentNat) =>
                    resolveLocalCurrencyPriceNationality(updated.nationalityCodes, currentNat),
                  );
                  router.refresh();
                }}
              />

              {selected.nationalityCodes.length > 0 && activePriceNationality ? (
                <LocalCurrencyPricesEditor
                  key={`${selected.code}:${activePriceNationality}`}
                  currencyCode={selected.code}
                  nationalityCode={activePriceNationality}
                  nationalityCodes={selected.nationalityCodes}
                  onPickNationality={setPriceNationalityPick}
                  canWrite={canWrite}
                  saving={saving}
                  onSavingChange={setSaving}
                  onFlash={flash}
                />
              ) : (
                <Card className="border-border border">
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">{selected.code} prices</CardTitle>
                    <CardDescription>Link at least one nationality before setting local prices.</CardDescription>
                  </CardHeader>
                </Card>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Select or create a local currency to edit links and prices.</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface ILocalCurrencyLinksEditorProps {
  currency: CatalogLocalCurrency;
  nationalityOptions: CatalogNationality[];
  canWrite: boolean;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onFlash: (text: string, err?: boolean) => void;
  onSaved: (updated: CatalogLocalCurrency) => void;
}

const LocalCurrencyLinksEditor: FC<ILocalCurrencyLinksEditorProps> = ({
  currency,
  nationalityOptions,
  canWrite,
  saving,
  onSavingChange,
  onFlash,
  onSaved,
}) => {
  const [editNationalities, setEditNationalities] = useState(currency.nationalityCodes);

  const onSaveLinks = async () => {
    onSavingChange(true);
    const res = await fetchApiEnvelope<{ localCurrency: CatalogLocalCurrency }>(
      apiHref(`/admin/catalog/local-currencies/${encodeURIComponent(currency.code)}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationalityCodes: editNationalities }),
      },
    );
    onSavingChange(false);
    if (!res.ok) {
      onFlash(res.error.message, true);
      return;
    }
    onSaved(res.data.localCurrency);
    onFlash(`Updated ${currency.code} nationality links.`);
  };

  return (
    <Card className="border-border border">
      <CardHeader>
        <CardTitle className="font-heading text-lg">{currency.code} nationality links</CardTitle>
        <CardDescription>
          Applicants with these passports see the {currency.code} tab. Everyone else only sees global USD and AED.
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
  );
};

interface ILocalCurrencyPricesEditorProps {
  currencyCode: string;
  nationalityCode: string;
  nationalityCodes: string[];
  onPickNationality: (code: string) => void;
  canWrite: boolean;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onFlash: (text: string, err?: boolean) => void;
}

const LocalCurrencyPricesEditor: FC<ILocalCurrencyPricesEditorProps> = ({
  currencyCode,
  nationalityCode,
  nationalityCodes,
  onPickNationality,
  canWrite,
  saving,
  onSavingChange,
  onFlash,
}) => {
  const [rows, setRows] = useState<TPriceRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingPrices(true);
      try {
        const res = await fetchApiEnvelope<{ rows: TPriceRow[] }>(
          apiHref(
            `/admin/catalog/local-currencies/${encodeURIComponent(currencyCode)}/prices?nationality=${encodeURIComponent(nationalityCode)}`,
          ),
        );
        if (cancelled) return;
        if (!res.ok) {
          onFlash(res.error.message, true);
          setRows([]);
          setDrafts({});
          return;
        }
        setRows(res.data.rows);
        setDrafts(majorDraftsFromRows(res.data.rows));
      } finally {
        if (!cancelled) setLoadingPrices(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currencyCode, nationalityCode, onFlash]);

  const onSavePrices = async () => {
    const updates = Object.entries(drafts)
      .filter(([, amountMajor]) => amountMajor.trim().length > 0)
      .map(([serviceId, amountMajor]) => ({ serviceId, amountMajor }));
    if (updates.length === 0) {
      onFlash("Enter at least one local price.", true);
      return;
    }
    onSavingChange(true);
    const res = await fetchApiEnvelope<{ rows: TPriceRow[] }>(
      apiHref(`/admin/catalog/local-currencies/${encodeURIComponent(currencyCode)}/prices`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nationalityCode, updates }),
      },
    );
    onSavingChange(false);
    if (!res.ok) {
      onFlash(res.error.message, true);
      return;
    }
    setRows(res.data.rows);
    setDrafts(majorDraftsFromRows(res.data.rows));
    onFlash(`Saved ${currencyCode} prices.`);
  };

  return (
    <Card className="border-border border">
      <CardHeader>
        <CardTitle className="font-heading text-lg">{currencyCode} prices</CardTitle>
        <CardDescription>
          Enter the customer total in {currencyCode} (minor units stored as kobo/cents). Global USD/AED columns are for
          reference only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {nationalityCodes.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {nationalityCodes.map((code) => (
              <Button
                key={code}
                type="button"
                variant={nationalityCode === code ? "default" : "outline"}
                size="sm"
                onClick={() => onPickNationality(code)}
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
                <TableHead className="min-w-[9rem]">{currencyCode}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingPrices && rows.length === 0 ? <AdminTableLoadingSkeleton columns={4} rows={8} /> : null}
              {rows.map((row) => (
                <TableRow key={row.serviceId}>
                  <TableCell>
                    <span className="font-medium">{row.serviceName}</span>
                    {!row.enabled ? <span className="text-muted-foreground ml-2 text-xs">(disabled)</span> : null}
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
                      placeholder="e.g. 185000.00"
                      className="font-mono text-sm"
                      disabled={!canWrite || saving}
                      value={drafts[row.serviceId] ?? ""}
                      onChange={(e) => setDrafts((current) => ({ ...current, [row.serviceId]: e.target.value }))}
                      aria-label={`${currencyCode} price for ${row.serviceName}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminTableLoadingFrame>
        {canWrite ? (
          <Button type="button" disabled={saving || loadingPrices} onClick={() => void onSavePrices()}>
            Save {currencyCode} prices
          </Button>
        ) : null}
      </CardContent>
    </Card>
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