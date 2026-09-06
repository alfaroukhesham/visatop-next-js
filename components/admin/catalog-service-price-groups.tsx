"use client";

import Link from "next/link";
import { useMemo, useState, type FC } from "react";
import { ChevronDown, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
import { usePaginatedList } from "@/components/admin/use-paginated-list";
import { CatalogServicePriceInputs } from "@/components/admin/catalog-service-price-inputs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { FX_SETTINGS_HREF } from "@/lib/admin/catalog/apply-service-price-ui-updates";
import {
  applyManualAedChange,
  applyManualUsdChange,
  hasValidPriceAmount,
  needsFxForPair,
  type TFxFillDirty,
} from "@/lib/admin/catalog/service-price-fx-fill";
import type { TServicePricingGroup } from "@/lib/admin/catalog/list-service-pricing";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

type TNationalityOption = { code: string; name: string; enabled: boolean };

type TLocalPriceGroup = {
  key: string;
  aedMajor: string;
  usdMajor: string;
  nationalityCodes: Set<string>;
};

const newGroupKey = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `group-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toLocalGroups = (groups: TServicePricingGroup[]): TLocalPriceGroup[] =>
  groups.map((g) => ({
    key: newGroupKey(),
    aedMajor: g.aedMajor,
    usdMajor: g.usdMajor,
    nationalityCodes: new Set(g.nationalityCodes),
  }));

interface IPriceGroupCardProps {
  group: TLocalPriceGroup;
  nationalities: TNationalityOption[];
  assignedElsewhere: Set<string>;
  fxConfigured: boolean;
  fxAedPerUsd: string | null;
  canWrite: boolean;
  busy: boolean;
  coversAllEnabled: boolean;
  onAedChange: (value: string) => void;
  onUsdChange: (value: string) => void;
  onToggleNat: (code: string, checked: boolean) => void;
  onRemove: () => void;
}

const PriceGroupCard: FC<IPriceGroupCardProps> = ({
  group,
  nationalities,
  assignedElsewhere,
  fxConfigured,
  fxAedPerUsd,
  canWrite,
  busy,
  onAedChange,
  onUsdChange,
  onToggleNat,
  onRemove,
  coversAllEnabled,
}) => {
  const [search, setSearch] = useState("");
  const [natsOpen, setNatsOpen] = useState(() => group.nationalityCodes.size === 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = nationalities.filter((n) => n.enabled);
    if (!q) return list;
    return list.filter(
      (n) => n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q),
    );
  }, [nationalities, search]);

  const { setPage, ...page } = usePaginatedList(filtered);

  const showFxBlock =
    group.nationalityCodes.size > 0 &&
    needsFxForPair(group.aedMajor, group.usdMajor) &&
    !fxConfigured;

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 space-y-4 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-base">
              {coversAllEnabled ? "All nationalities" : "Price group"}
            </CardTitle>
            <CardDescription>
              {coversAllEnabled
                ? "Same AED/USD for every enabled nationality. Edit the amounts below, then save."
                : "Edit AED/USD below. Open nationalities to change who gets this price."}
            </CardDescription>
          </div>
          {canWrite ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
              <Trash2 className="size-4" />
              Remove group
            </Button>
          ) : null}
        </div>
        <CatalogServicePriceInputs
          idPrefix={`group-${group.key}`}
          aedMajor={group.aedMajor}
          usdMajor={group.usdMajor}
          onAedChange={onAedChange}
          onUsdChange={onUsdChange}
          fxConfigured={fxConfigured}
          fxAedPerUsd={fxAedPerUsd}
          disabled={!canWrite || busy}
          showFxMissingHint={showFxBlock}
        />
      </CardHeader>
      <button
        type="button"
        className="border-border flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={natsOpen}
        aria-controls={`group-${group.key}-nationalities`}
        onClick={() => setNatsOpen((open) => !open)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">Nationalities</span>
          <span className="text-muted-foreground block text-xs">
            {coversAllEnabled
              ? "All enabled nationalities"
              : `${group.nationalityCodes.size} ${
                  group.nationalityCodes.size === 1 ? "nationality" : "nationalities"
                } selected`}
          </span>
        </span>
        <ChevronDown
          className={`text-muted-foreground size-4 shrink-0 transition-transform ${
            natsOpen ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {natsOpen ? (
        <CardContent id={`group-${group.key}-nationalities`} className="p-0">
          <div className="border-border border-y px-4 py-3">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search nationalities…"
                className="pl-9"
                autoComplete="off"
                disabled={busy}
                aria-label="Search nationalities"
              />
            </div>
          </div>
          {page.pageItems.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              {search.trim() ? "No matches." : "No enabled nationalities."}
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {page.pageItems.map((n) => {
                const checked = group.nationalityCodes.has(n.code);
                const inOtherGroup = assignedElsewhere.has(n.code);
                const label = `${n.name} (${n.code})`;
                return (
                  <li key={n.code}>
                    {canWrite ? (
                      <label className="flex min-h-6 w-full cursor-pointer items-center gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          className="accent-primary size-4 shrink-0"
                          checked={checked}
                          disabled={busy || (inOtherGroup && !checked)}
                          onChange={(e) => onToggleNat(n.code, e.target.checked)}
                          aria-label={label}
                        />
                        <span className="font-medium">{label}</span>
                        {inOtherGroup && !checked ? (
                          <span className="text-muted-foreground text-xs">In another group</span>
                        ) : null}
                      </label>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className="font-medium">{label}</span>
                        {checked ? (
                          <span className="text-muted-foreground text-xs">In this group</span>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <ListPaginatorBar
            selectId={`group-${group.key}-page-size`}
            page={page.page}
            setPage={setPage}
            pageSize={page.pageSize}
            onPageSizeChange={page.onPageSizeChange}
            total={page.total}
            disabled={busy}
          />
        </CardContent>
      ) : null}
    </Card>
  );
};

interface ICatalogServicePriceGroupsProps {
  serviceId: string;
  canWrite: boolean;
  fxConfigured: boolean;
  fxAedPerUsd: string | null;
  initialGroups: TServicePricingGroup[];
  nationalities: TNationalityOption[];
  onSaved?: () => void;
}

export const CatalogServicePriceGroups: FC<ICatalogServicePriceGroupsProps> = ({
  serviceId,
  canWrite,
  fxConfigured,
  fxAedPerUsd,
  initialGroups,
  nationalities,
  onSaved,
}) => {
  const [groups, setGroups] = useState<TLocalPriceGroup[]>(() => toLocalGroups(initialGroups));
  const [dirtyByGroup, setDirtyByGroup] = useState<Record<string, TFxFillDirty>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const assignedElsewhereFor = (groupKey: string): Set<string> => {
    const elsewhere = new Set<string>();
    for (const g of groups) {
      if (g.key === groupKey) continue;
      for (const code of g.nationalityCodes) elsewhere.add(code);
    }
    return elsewhere;
  };

  const totalAssigned = useMemo(
    () => groups.reduce((sum, g) => sum + g.nationalityCodes.size, 0),
    [groups],
  );

  const updateGroupPrices = (groupKey: string, field: "aed" | "usd", value: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.key !== groupKey) return g;
        const dirty = dirtyByGroup[groupKey] ?? { aed: false, usd: false };
        const next =
          field === "aed"
            ? applyManualAedChange(value, g.usdMajor, dirty, fxConfigured, fxAedPerUsd)
            : applyManualUsdChange(value, g.aedMajor, dirty, fxConfigured, fxAedPerUsd);
        setDirtyByGroup((d) => ({ ...d, [groupKey]: next.dirty }));
        return { ...g, aedMajor: next.aed, usdMajor: next.usd };
      }),
    );
  };

  const toggleNatInGroup = (groupKey: string, code: string, checked: boolean) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.key === groupKey) {
          const codes = new Set(g.nationalityCodes);
          if (checked) codes.add(code);
          else codes.delete(code);
          return { ...g, nationalityCodes: codes };
        }
        if (checked && g.nationalityCodes.has(code)) {
          const codes = new Set(g.nationalityCodes);
          codes.delete(code);
          return { ...g, nationalityCodes: codes };
        }
        return g;
      }),
    );
  };

  const validateGroups = (): string | null => {
    for (const group of groups) {
      if (group.nationalityCodes.size === 0) continue;
      if (!hasValidPriceAmount(group.aedMajor, group.usdMajor)) {
        return "Each group with nationalities must include at least one valid price amount.";
      }
      if (needsFxForPair(group.aedMajor, group.usdMajor) && !fxConfigured) {
        return "FX is not configured. Open Settings, set AED per 1 USD, then come back.";
      }
    }
    return null;
  };

  const buildPayload = () =>
    groups
      .filter((g) => g.nationalityCodes.size > 0)
      .map((g) => ({
        aedMajor: g.aedMajor.trim() || undefined,
        usdMajor: g.usdMajor.trim() || undefined,
        nationalityCodes: [...g.nationalityCodes],
      }));

  const putGroups = async (
    payload: Array<{
      aedMajor?: string;
      usdMajor?: string;
      nationalityCodes: string[];
    }>,
  ) => {
    setBusy(true);
    try {
      const res = await fetchApiEnvelope<{ updated: number; removed: number }>(
        apiHref(`/admin/catalog/customer-prices/service/${encodeURIComponent(serviceId)}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "groups", groups: payload }),
        },
      );
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setBanner("Saved price groups.");
      setTimeout(() => setBanner(null), 4000);
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  const saveGroups = async () => {
    if (!canWrite) return;
    setError(null);

    const validationError = validateGroups();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (totalAssigned === 0) {
      setClearConfirmOpen(true);
      return;
    }

    await putGroups(buildPayload());
  };

  const confirmClear = async () => {
    setClearConfirmOpen(false);
    await putGroups([]);
    setGroups([]);
    setDirtyByGroup({});
  };

  const addGroup = () => {
    const key = newGroupKey();
    setGroups((prev) => [
      ...prev,
      { key, aedMajor: "", usdMajor: "", nationalityCodes: new Set() },
    ]);
    setDirtyByGroup((d) => ({ ...d, [key]: { aed: false, usd: false } }));
  };

  const removeGroup = (key: string) => {
    setGroups((prev) => prev.filter((g) => g.key !== key));
    setDirtyByGroup((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg">Price by nationality</h3>
          <p className="text-muted-foreground text-sm">
            Edit amounts on a group, then open Nationalities to assign countries. Each nationality
            can belong to one group only.
          </p>
        </div>
        {canWrite ? (
          <Button type="button" variant="secondary" disabled={busy} onClick={addGroup}>
            <Plus className="size-4" />
            Add price group
          </Button>
        ) : null}
      </div>

      {banner ? (
        <p
          className="border-success/40 bg-success/10 text-success border-b-2 px-4 py-3 text-sm"
          role="status"
        >
          {banner}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
          {error.includes("FX is not configured") ? (
            <>
              {" "}
              <Link href={FX_SETTINGS_HREF} className="underline underline-offset-4">
                Open Settings
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {groups.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-none border border-dashed px-4 py-8 text-center text-sm">
          {canWrite
            ? "No price groups yet. Add a group to set prices by nationality."
            : "No price groups configured for this service."}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const enabledCodes = nationalities.filter((n) => n.enabled).map((n) => n.code);
            const coversAllEnabled =
              enabledCodes.length > 0 &&
              enabledCodes.every((code) => group.nationalityCodes.has(code));
            return (
            <PriceGroupCard
              key={group.key}
              group={group}
              nationalities={nationalities}
              assignedElsewhere={assignedElsewhereFor(group.key)}
              fxConfigured={fxConfigured}
              fxAedPerUsd={fxAedPerUsd}
              canWrite={canWrite}
              busy={busy}
              coversAllEnabled={coversAllEnabled}
              onAedChange={(value) => updateGroupPrices(group.key, "aed", value)}
              onUsdChange={(value) => updateGroupPrices(group.key, "usd", value)}
              onToggleNat={(code, checked) => toggleNatInGroup(group.key, code, checked)}
              onRemove={() => removeGroup(group.key)}
            />
            );
          })}
        </div>
      )}

      {canWrite ? (
        <div className="flex justify-end">
          <Button type="button" disabled={busy} onClick={() => void saveGroups()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Save groups
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title="Clear all prices for this service?"
        description="No nationalities are assigned to a price group. Saving will remove all customer prices and eligibility links created through pricing for this service."
        confirmLabel="Clear prices"
        confirmVariant="destructive"
        confirmBusy={busy}
        onConfirm={() => void confirmClear()}
      />
    </div>
  );
};
