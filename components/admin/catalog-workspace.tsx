"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { AdminListFilters } from "@/components/admin/admin-list-filters";
import {
  AdminTableLoadingFrame,
  AdminTableLoadingSkeleton,
} from "@/components/admin/admin-loading";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
import {
  EMPTY_CATALOG_ELIGIBILITY_FILTERS,
  useCatalogEligibilityPage,
  type CatalogEligibilityFilters,
} from "@/components/admin/use-catalog-eligibility-page";
import { usePaginatedList } from "@/components/admin/use-paginated-list";
import type {
  CatalogEligibility,
  CatalogNationality,
  CatalogService,
} from "@/lib/admin/catalog/catalog-types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";
import { cn } from "@/lib/utils";

export type { CatalogEligibility, CatalogNationality, CatalogService };

function filterByQuery<T>(items: T[], query: string, parts: (item: T) => string[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    parts(item).some((part) => part.toLowerCase().includes(q)),
  );
}

function CatalogSectionSearch({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        autoComplete="off"
        disabled={disabled}
        aria-label={placeholder}
      />
    </div>
  );
}

type Props = {
  nationalities: CatalogNationality[];
  services: CatalogService[];
  canWrite: boolean;
};

export function AdminCatalogWorkspace({
  nationalities,
  services,
  canWrite,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function flash(msg: string, err = false) {
    setBanner({ type: err ? "err" : "ok", text: msg });
    setTimeout(() => setBanner(null), 4000);
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      {banner ? (
        <p
          className={
            banner.type === "err"
              ? "border-destructive/40 bg-destructive/10 text-destructive border-b-2 px-4 py-3 text-sm"
              : "border-success/40 bg-success/10 text-success border-b-2 px-4 py-3 text-sm"
          }
          role="status"
        >
          {banner.text}
        </p>
      ) : null}

      <NationalitiesSection
        rows={nationalities}
        canWrite={canWrite}
        busy={busy}
        run={run}
        flash={flash}
      />
      <ServicesSection rows={services} canWrite={canWrite} busy={busy} run={run} flash={flash} />
      <EligibilitySection
        services={services}
        nationalities={nationalities}
        canWrite={canWrite}
        busy={busy}
        flash={flash}
      />
    </div>
  );
}

function NationalitiesSection({
  rows,
  canWrite,
  busy,
  run,
  flash,
}: {
  rows: CatalogNationality[];
  canWrite: boolean;
  busy: string | null;
  run: (k: string, fn: () => Promise<void>) => Promise<void>;
  flash: (t: string, err?: boolean) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const filteredRows = useMemo(
    () => filterByQuery(rows, search, (n) => [n.code, n.name]),
    [rows, search],
  );
  const { setPage: setNatPage, ...natPageRest } = usePaginatedList(filteredRows);
  const natPage = { ...natPageRest, setPage: setNatPage };

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 space-y-4 border-b">
        <div>
          <CardTitle className="font-heading text-lg">Nationalities</CardTitle>
          <CardDescription>
            ISO alpha-2 codes. Public catalog only lists enabled rows with at least one eligible service.
          </CardDescription>
        </div>
        <CatalogSectionSearch
          id="catalog-nationalities-search"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setNatPage(0);
          }}
          placeholder="Search by code or name…"
          disabled={busy !== null}
        />
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground font-body text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Enabled</th>
                {canWrite ? <th className="px-4 py-3 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {natPage.pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={canWrite ? 4 : 3}
                    className="text-muted-foreground px-4 py-6 text-center text-sm"
                  >
                    {search.trim() ? "No nationalities match your search." : "No nationalities yet."}
                  </td>
                </tr>
              ) : null}
              {natPage.pageItems.map((n) => (
                <NationalityRow
                  key={`${n.code}:${n.name}:${n.enabled ? 1 : 0}`}
                  n={n}
                  canWrite={canWrite}
                  busy={busy}
                  run={run}
                  flash={flash}
                />
              ))}
            </tbody>
          </table>
        </div>
        <ListPaginatorBar
          selectId="catalog-nationalities-page-size"
          page={natPage.page}
          setPage={natPage.setPage}
          pageSize={natPage.pageSize}
          onPageSizeChange={natPage.onPageSizeChange}
          total={natPage.total}
          disabled={busy !== null}
        />
        {canWrite ? (
          <form
            className="border-border flex flex-wrap items-end gap-3 border-t bg-muted/10 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(`nat-add-${code}`, async () => {
                const res = await fetchApiEnvelope<{ nationality: CatalogNationality }>(
                  apiHref("/admin/catalog/nationalities"),
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      code,
                      name,
                      enabled: true,
                    }),
                  },
                );
                if (!res.ok) {
                  flash(res.error.message, true);
                  throw new Error("fail");
                }
                flash(`Saved nationality ${res.data.nationality.code}`);
                setCode("");
                setName("");
              });
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="new-nat-code">New code</Label>
              <Input
                id="new-nat-code"
                className="font-mono uppercase"
                maxLength={2}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="US"
              />
            </div>
            <div className="min-w-[12rem] flex-1 space-y-1">
              <Label htmlFor="new-nat-name">Display name</Label>
              <Input
                id="new-nat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="United States"
              />
            </div>
            <Button type="submit" disabled={busy !== null || code.length !== 2 || !name.trim()}>
              {busy?.startsWith("nat-add") ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add or update
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NationalityRow({
  n,
  canWrite,
  busy,
  run,
  flash,
}: {
  n: CatalogNationality;
  canWrite: boolean;
  busy: string | null;
  run: (k: string, fn: () => Promise<void>) => Promise<void>;
  flash: (t: string, err?: boolean) => void;
}) {
  const [name, setName] = useState(n.name);
  const [enabled, setEnabled] = useState(n.enabled);

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3 font-mono text-xs">{n.code}</td>
      <td className="px-4 py-3">
        {canWrite ? (
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 max-w-xs font-body" />
        ) : (
          <span className="font-medium">{n.name}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {canWrite ? (
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            aria-label={`Enabled ${n.code}`}
          />
        ) : n.enabled ? (
          "Yes"
        ) : (
          "No"
        )}
      </td>
      {canWrite ? (
        <td className="px-4 py-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy !== null}
            onClick={() =>
              void run(`nat-${n.code}`, async () => {
                const res = await fetchApiEnvelope<{ nationality: CatalogNationality }>(
                  apiHref(`/admin/catalog/nationalities/${encodeURIComponent(n.code)}`),
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, enabled }),
                  },
                );
                if (!res.ok) {
                  flash(res.error.message, true);
                  throw new Error("fail");
                }
                flash(`Updated ${n.code}`);
              })
            }
          >
            {busy === `nat-${n.code}` ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </td>
      ) : null}
    </tr>
  );
}

function ServicesSection({
  rows,
  canWrite,
  busy,
  run,
  flash,
}: {
  rows: CatalogService[];
  canWrite: boolean;
  busy: string | null;
  run: (k: string, fn: () => Promise<void>) => Promise<void>;
  flash: (t: string, err?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [entries, setEntries] = useState("");
  const [search, setSearch] = useState("");
  const filteredRows = useMemo(
    () =>
      filterByQuery(rows, search, (s) => [
        s.name,
        s.id,
        s.entries ?? "",
        s.durationDays === null || s.durationDays === undefined ? "" : String(s.durationDays),
      ]),
    [rows, search],
  );
  const { setPage: setSvcPage, ...svcPageRest } = usePaginatedList(filteredRows);
  const svcPage = { ...svcPageRest, setPage: setSvcPage };

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 space-y-4 border-b">
        <div className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="font-heading text-lg">Visa services</CardTitle>
            <CardDescription>Variants shown in the apply flow and public pricing resolution.</CardDescription>
          </div>
          {canWrite ? (
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button type="button">New service</Button>} />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create service</DialogTitle>
                <DialogDescription>Identifier is generated server-side.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label htmlFor="svc-name">Name</Label>
                  <Input id="svc-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="svc-days">Duration (days)</Label>
                  <Input
                    id="svc-days"
                    inputMode="numeric"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    placeholder="30"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="svc-entries">Entries label</Label>
                  <Input
                    id="svc-entries"
                    value={entries}
                    onChange={(e) => setEntries(e.target.value)}
                    placeholder="single"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() =>
                    void run("svc-create", async () => {
                      const d = durationDays.trim() === "" ? null : Number.parseInt(durationDays, 10);
                      const res = await fetchApiEnvelope<{ service: CatalogService }>(
                        apiHref("/admin/catalog/visa-services"),
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: name.trim(),
                            enabled: true,
                            durationDays: Number.isFinite(d) ? d : null,
                            entries: entries.trim() === "" ? null : entries.trim(),
                          }),
                        },
                      );
                      if (!res.ok) {
                        flash(res.error.message, true);
                        throw new Error("fail");
                      }
                      flash(`Created service ${res.data.service.name}`);
                      setOpen(false);
                      setName("");
                      setDurationDays("");
                      setEntries("");
                    })
                  }
                  disabled={busy !== null || !name.trim()}
                >
                  {busy === "svc-create" ? <Loader2 className="size-4 animate-spin" /> : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : null}
        </div>
        <CatalogSectionSearch
          id="catalog-services-search"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setSvcPage(0);
          }}
          placeholder="Search by name, id, duration, or entries…"
          disabled={busy !== null}
        />
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground font-body text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Entries</th>
                <th className="px-4 py-3 font-medium">On</th>
                {canWrite ? <th className="px-4 py-3 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {svcPage.pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={canWrite ? 5 : 4}
                    className="text-muted-foreground px-4 py-6 text-center text-sm"
                  >
                    {search.trim() ? "No services match your search." : "No visa services yet."}
                  </td>
                </tr>
              ) : null}
              {svcPage.pageItems.map((s) => (
                <ServiceRow
                  key={`${s.id}:${s.name}:${s.durationDays ?? ""}:${s.entries ?? ""}:${s.enabled ? 1 : 0}`}
                  s={s}
                  canWrite={canWrite}
                  busy={busy}
                  run={run}
                  flash={flash}
                />
              ))}
            </tbody>
          </table>
        </div>
        <ListPaginatorBar
          selectId="catalog-services-page-size"
          page={svcPage.page}
          setPage={svcPage.setPage}
          pageSize={svcPage.pageSize}
          onPageSizeChange={svcPage.onPageSizeChange}
          total={svcPage.total}
          disabled={busy !== null}
        />
      </CardContent>
    </Card>
  );
}

function ServiceRow({
  s,
  canWrite,
  busy,
  run,
  flash,
}: {
  s: CatalogService;
  canWrite: boolean;
  busy: string | null;
  run: (k: string, fn: () => Promise<void>) => Promise<void>;
  flash: (t: string, err?: boolean) => void;
}) {
  const [name, setName] = useState(s.name);
  const [durationDays, setDurationDays] = useState(
    s.durationDays === null || s.durationDays === undefined ? "" : String(s.durationDays),
  );
  const [entries, setEntries] = useState(s.entries ?? "");
  const [enabled, setEnabled] = useState(s.enabled);

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="text-muted-foreground mb-1 font-mono text-[10px] leading-none break-all">{s.id}</div>
        {canWrite ? (
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 max-w-md font-body" />
        ) : (
          <span className="font-medium">{s.name}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {canWrite ? (
          <Input
            className="h-8 w-24 font-mono"
            inputMode="numeric"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
          />
        ) : (
          <span className="font-mono text-xs">{s.durationDays ?? ", "}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {canWrite ? (
          <Input className="h-8 w-28 font-mono text-xs" value={entries} onChange={(e) => setEntries(e.target.value)} />
        ) : (
          <span className="font-mono text-xs">{s.entries ?? ", "}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {canWrite ? (
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            aria-label={`Enabled ${s.name}`}
          />
        ) : s.enabled ? (
          "Yes"
        ) : (
          "No"
        )}
      </td>
      {canWrite ? (
        <td className="px-4 py-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy !== null}
            onClick={() =>
              void run(`svc-${s.id}`, async () => {
                const dRaw = durationDays.trim();
                const d = dRaw === "" ? null : Number.parseInt(dRaw, 10);
                const res = await fetchApiEnvelope<{ service: CatalogService }>(
                  apiHref(`/admin/catalog/visa-services/${encodeURIComponent(s.id)}`),
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name,
                      enabled,
                      durationDays: dRaw === "" ? null : Number.isFinite(d) ? d : undefined,
                      entries: entries.trim() === "" ? null : entries.trim(),
                    }),
                  },
                );
                if (!res.ok) {
                  flash(res.error.message, true);
                  throw new Error("fail");
                }
                flash(`Updated ${s.name}`);
              })
            }
          >
            {busy === `svc-${s.id}` ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </td>
      ) : null}
    </tr>
  );
}

function EligibilitySection({
  services,
  nationalities,
  canWrite,
  busy,
  flash,
}: {
  services: CatalogService[];
  nationalities: CatalogNationality[];
  canWrite: boolean;
  busy: string | null;
  flash: (t: string, err?: boolean) => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [nationalityCode, setNationalityCode] = useState(nationalities[0]?.code ?? "");
  const [eligBusy, setEligBusy] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<CatalogEligibilityFilters>(
    EMPTY_CATALOG_ELIGIBILITY_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<CatalogEligibilityFilters>(
    EMPTY_CATALOG_ELIGIBILITY_FILTERS,
  );
  const eligPage = useCatalogEligibilityPage(10, appliedFilters);
  const sectionBusy = busy !== null || eligBusy !== null;

  const serviceFilterOptions = useMemo(
    () => services.map((s) => ({ value: s.id, label: s.name })),
    [services],
  );
  const nationalityFilterOptions = useMemo(
    () => nationalities.map((n) => ({ value: n.code, label: `${n.code} ,  ${n.name}` })),
    [nationalities],
  );
  const filterValues = useMemo(
    () => ({
      q: draftFilters.q,
      serviceId: draftFilters.serviceId,
      nationalityCode: draftFilters.nationalityCode,
    }),
    [draftFilters],
  );
  const hasActiveFilters =
    Boolean(appliedFilters.q.trim()) ||
    Boolean(appliedFilters.serviceId) ||
    Boolean(appliedFilters.nationalityCode);

  async function runElig(key: string, fn: () => Promise<void>) {
    setEligBusy(key);
    try {
      await fn();
      eligPage.reload();
    } finally {
      setEligBusy(null);
    }
  }

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 border-b">
        <CardTitle className="font-heading text-lg">Service ↔ nationality eligibility</CardTitle>
        <CardDescription>
          Loaded in pages from the server ({eligPage.total.toLocaleString()} links). Controls which
          combinations appear in the public services list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {eligPage.error ? (
          <p className="text-destructive text-sm" role="alert">
            {eligPage.error}
          </p>
        ) : null}
        <AdminListFilters
          fields={[
            {
              kind: "search",
              key: "q",
              label: "Search",
              placeholder: "Service name, id, or nationality code…",
            },
            {
              kind: "select",
              key: "serviceId",
              label: "Service",
              options: serviceFilterOptions,
              allLabel: "All services",
            },
            {
              kind: "select",
              key: "nationalityCode",
              label: "Nationality",
              options: nationalityFilterOptions,
              allLabel: "All nationalities",
            },
          ]}
          values={filterValues}
          onChange={(key, value) => setDraftFilters((prev) => ({ ...prev, [key]: value }))}
          onApply={() => {
            setAppliedFilters({ ...draftFilters });
            eligPage.setPage(0);
          }}
          onClear={() => {
            setDraftFilters(EMPTY_CATALOG_ELIGIBILITY_FILTERS);
            setAppliedFilters(EMPTY_CATALOG_ELIGIBILITY_FILTERS);
            eligPage.setPage(0);
          }}
          canClear={hasActiveFilters}
          applying={eligPage.loading}
          applyLabel="Apply filters"
          className="rounded-md"
        />
        {canWrite ? (
          <details className="group border-border rounded-md border">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
              Link a new service to an existing nationality
            </summary>
            <form
              className="border-border flex flex-wrap items-end gap-3 border-t p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void runElig("elig-add", async () => {
                  const res = await fetchApiEnvelope<{ eligibility: unknown }>(
                    apiHref("/admin/catalog/eligibility"),
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ serviceId, nationalityCode }),
                    },
                  );
                  if (!res.ok) {
                    flash(res.error.message, true);
                    throw new Error("fail");
                  }
                  flash("Eligibility saved (or already existed).");
                });
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="elig-link-service">Service</Label>
                <select
                  id="elig-link-service"
                  className="border-input bg-background h-9 w-56 rounded-md border px-2 text-sm"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="elig-link-nationality">Nationality</Label>
                <select
                  id="elig-link-nationality"
                  className="border-input bg-background h-9 w-40 rounded-md border px-2 font-mono text-sm"
                  value={nationalityCode}
                  onChange={(e) => setNationalityCode(e.target.value)}
                >
                  {nationalities.map((n) => (
                    <option key={n.code} value={n.code}>
                      {n.code} ,  {n.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={sectionBusy || !serviceId || !nationalityCode}>
                {eligBusy === "elig-add" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Link
              </Button>
            </form>
          </details>
        ) : null}
        <AdminTableLoadingFrame
          loading={eligPage.loading}
          hasRows={eligPage.items.length > 0}
          className="overflow-x-auto rounded-md border border-border"
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">Nationality</th>
                {canWrite ? <th className="px-4 py-2 font-medium">Remove</th> : null}
              </tr>
            </thead>
            <tbody className={cn("divide-border divide-y", eligPage.loading && eligPage.items.length === 0 && "admin-stagger")}>
              {eligPage.loading && eligPage.items.length === 0 ? (
                <AdminTableLoadingSkeleton
                  rows={Math.min(eligPage.pageSize, 8)}
                  columns={canWrite ? 3 : 2}
                  columnWidths={canWrite ? ["w-2/5", "w-20", "w-10"] : ["w-2/5", "w-20"]}
                />
              ) : null}
              {!eligPage.loading && eligPage.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={canWrite ? 3 : 2}
                    className="text-muted-foreground px-4 py-6 text-center text-sm"
                  >
                    {hasActiveFilters
                      ? "No eligibility links match your filters."
                      : "No eligibility links yet."}
                  </td>
                </tr>
              ) : null}
              {eligPage.items.map((e) => (
                <tr key={`${e.serviceId}-${e.nationalityCode}`} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <span className="font-medium">{e.serviceName}</span>
                    <div className="text-muted-foreground font-mono text-[10px] break-all">{e.serviceId}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{e.nationalityCode}</td>
                  {canWrite ? (
                    <td className="px-4 py-2">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={sectionBusy}
                        aria-label="Remove eligibility"
                        onClick={() =>
                          void runElig(`elig-del-${e.serviceId}-${e.nationalityCode}`, async () => {
                            const res = await fetchApiEnvelope<{ deleted: unknown }>(
                              apiHref("/admin/catalog/eligibility"),
                              {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  serviceId: e.serviceId,
                                  nationalityCode: e.nationalityCode,
                                }),
                              },
                            );
                            if (!res.ok) {
                              flash(res.error.message, true);
                              throw new Error("fail");
                            }
                            flash("Removed link.");
                          })
                        }
                      >
                        {eligBusy === `elig-del-${e.serviceId}-${e.nationalityCode}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableLoadingFrame>
        <ListPaginatorBar
          selectId="catalog-eligibility-page-size"
          page={eligPage.page}
          setPage={eligPage.setPage}
          pageSize={eligPage.pageSize}
          onPageSizeChange={eligPage.onPageSizeChange}
          total={eligPage.total}
          disabled={sectionBusy || eligPage.loading}
          loading={eligPage.loading}
        />
      </CardContent>
    </Card>
  );
}
