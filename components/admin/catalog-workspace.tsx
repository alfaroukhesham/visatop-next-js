"use client";

import { useRouter } from "next/navigation";
import { useMemo, useReducer, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { CatalogEligibilitySection } from "@/components/admin/catalog-eligibility-section";
import { CatalogDocumentRulesSection } from "@/components/admin/catalog-document-rules-section";
import { ListPaginatorBar } from "@/components/admin/list-paginator-bar";
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
  const [eligibilityPrefill, setEligibilityPrefill] = useState<string | undefined>(undefined);
  const [pickerRefreshKey, setPickerRefreshKey] = useState(0);

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
      <CatalogEligibilitySection
        services={services}
        nationalities={nationalities}
        canWrite={canWrite}
        busy={busy}
        flash={flash}
        prefillNationalityCode={eligibilityPrefill}
        onPrefillConsumed={() => setEligibilityPrefill(undefined)}
        onEligibilityChanged={() => setPickerRefreshKey((n) => n + 1)}
      />
      <CatalogDocumentRulesSection
        canWrite={canWrite}
        busy={busy !== null}
        flash={flash}
        pickerRefreshKey={pickerRefreshKey}
        onAddEligibility={(nationalityCode) => {
          setEligibilityPrefill(nationalityCode);
          document.getElementById("catalog-eligibility")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
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
          <div className="border-border flex flex-wrap items-end gap-3 border-t bg-muted/10 p-4">
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
            <Button
              type="button"
              disabled={busy !== null || code.length !== 2 || !name.trim()}
              onClick={() =>
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
                })
              }
            >
              {busy?.startsWith("nat-add") ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add or update
            </Button>
          </div>
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
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null);
  const name = nameOverride ?? n.name;
  const enabled = enabledOverride ?? n.enabled;

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3 font-mono text-xs">{n.code}</td>
      <td className="px-4 py-3">
        {canWrite ? (
          <Input
            value={name}
            onChange={(e) => setNameOverride(e.target.value)}
            className="h-8 max-w-xs font-body"
          />
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
            onChange={(e) => setEnabledOverride(e.target.checked)}
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
  type ServicesUiState = {
    open: boolean;
    name: string;
    durationDays: string;
    entries: string;
    search: string;
  };
  type ServicesUiAction =
    | { type: "patch"; patch: Partial<ServicesUiState> }
    | { type: "reset-create-form" };

  const [ui, dispatchUi] = useReducer(
    (state: ServicesUiState, action: ServicesUiAction): ServicesUiState => {
      switch (action.type) {
        case "patch":
          return { ...state, ...action.patch };
        case "reset-create-form":
          return { ...state, open: false, name: "", durationDays: "", entries: "" };
        default:
          return state;
      }
    },
    { open: false, name: "", durationDays: "", entries: "", search: "" },
  );
  const { open, name, durationDays, entries, search } = ui;
  const setOpen = (value: boolean) => dispatchUi({ type: "patch", patch: { open: value } });
  const setName = (value: string) => dispatchUi({ type: "patch", patch: { name: value } });
  const setDurationDays = (value: string) => dispatchUi({ type: "patch", patch: { durationDays: value } });
  const setEntries = (value: string) => dispatchUi({ type: "patch", patch: { entries: value } });
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
                      dispatchUi({ type: "reset-create-form" });
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
            dispatchUi({ type: "patch", patch: { search: value } });
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
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [durationOverride, setDurationOverride] = useState<string | null>(null);
  const [entriesOverride, setEntriesOverride] = useState<string | null>(null);
  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null);
  const defaultDuration =
    s.durationDays === null || s.durationDays === undefined ? "" : String(s.durationDays);
  const name = nameOverride ?? s.name;
  const durationDays = durationOverride ?? defaultDuration;
  const entries = entriesOverride ?? (s.entries ?? "");
  const enabled = enabledOverride ?? s.enabled;

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="text-muted-foreground mb-1 font-mono text-[10px] leading-none break-all">{s.id}</div>
        {canWrite ? (
          <Input value={name} onChange={(e) => setNameOverride(e.target.value)} className="h-8 max-w-md font-body" />
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
            onChange={(e) => setDurationOverride(e.target.value)}
          />
        ) : (
          <span className="font-mono text-xs">{s.durationDays ?? ", "}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {canWrite ? (
          <Input className="h-8 w-28 font-mono text-xs" value={entries} onChange={(e) => setEntriesOverride(e.target.value)} />
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
            onChange={(e) => setEnabledOverride(e.target.checked)}
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
