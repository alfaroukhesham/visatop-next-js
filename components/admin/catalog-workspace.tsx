"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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

export type CatalogNationality = {
  code: string;
  name: string;
  enabled: boolean;
};

export type CatalogService = {
  id: string;
  name: string;
  enabled: boolean;
  durationDays: number | null;
  entries: string | null;
};

export type CatalogEligibility = {
  serviceId: string;
  nationalityCode: string;
  serviceName: string;
};

type Props = {
  nationalities: CatalogNationality[];
  services: CatalogService[];
  eligibility: CatalogEligibility[];
  canWrite: boolean;
};

export function AdminCatalogWorkspace({
  nationalities,
  services,
  eligibility,
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
              ? "border-destructive/40 bg-destructive/10 text-destructive border-l-4 px-4 py-3 text-sm"
              : "border-success/40 bg-success/10 text-success border-l-4 px-4 py-3 text-sm"
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
        eligibility={eligibility}
        services={services}
        nationalities={nationalities}
        canWrite={canWrite}
        busy={busy}
        run={run}
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

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 border-b">
        <CardTitle className="font-heading text-lg">Nationalities</CardTitle>
        <CardDescription>
          ISO alpha-2 codes. Public catalog only lists enabled rows with at least one eligible service.
        </CardDescription>
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
              {rows.map((n) => (
                <NationalityRow key={n.code} n={n} canWrite={canWrite} busy={busy} run={run} flash={flash} />
              ))}
            </tbody>
          </table>
        </div>
        {canWrite ? (
          <form
            className="border-border flex flex-wrap items-end gap-3 border-t bg-muted/10 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(`nat-add-${code}`, async () => {
                const res = await fetchApiEnvelope<{ nationality: CatalogNationality }>(
                  "/api/admin/catalog/nationalities",
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

  useEffect(() => {
    setName(n.name);
    setEnabled(n.enabled);
  }, [n.name, n.enabled]);

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
                  `/api/admin/catalog/nationalities/${encodeURIComponent(n.code)}`,
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

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 border-b border-border bg-muted/20">
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
                        "/api/admin/catalog/visa-services",
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
              {rows.map((s) => (
                <ServiceRow key={s.id} s={s} canWrite={canWrite} busy={busy} run={run} flash={flash} />
              ))}
            </tbody>
          </table>
        </div>
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

  useEffect(() => {
    setName(s.name);
    setDurationDays(s.durationDays === null || s.durationDays === undefined ? "" : String(s.durationDays));
    setEntries(s.entries ?? "");
    setEnabled(s.enabled);
  }, [s.name, s.durationDays, s.entries, s.enabled]);

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
          <span className="font-mono text-xs">{s.durationDays ?? "—"}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {canWrite ? (
          <Input className="h-8 w-28 font-mono text-xs" value={entries} onChange={(e) => setEntries(e.target.value)} />
        ) : (
          <span className="font-mono text-xs">{s.entries ?? "—"}</span>
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
                  `/api/admin/catalog/visa-services/${encodeURIComponent(s.id)}`,
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
  eligibility,
  services,
  nationalities,
  canWrite,
  busy,
  run,
  flash,
}: {
  eligibility: CatalogEligibility[];
  services: CatalogService[];
  nationalities: CatalogNationality[];
  canWrite: boolean;
  busy: string | null;
  run: (k: string, fn: () => Promise<void>) => Promise<void>;
  flash: (t: string, err?: boolean) => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [nationalityCode, setNationalityCode] = useState(nationalities[0]?.code ?? "");

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="border-border bg-muted/20 border-b">
        <CardTitle className="font-heading text-lg">Service ↔ nationality eligibility</CardTitle>
        <CardDescription>Controls which combinations appear in the public services list.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {canWrite ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run("elig-add", async () => {
                const res = await fetchApiEnvelope<{ eligibility: unknown }>("/api/admin/catalog/eligibility", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ serviceId, nationalityCode }),
                });
                if (!res.ok) {
                  flash(res.error.message, true);
                  throw new Error("fail");
                }
                flash("Eligibility saved (or already existed).");
              });
            }}
          >
            <div className="space-y-1">
              <Label>Service</Label>
              <select
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
              <Label>Nationality</Label>
              <select
                className="border-input bg-background h-9 w-40 rounded-md border px-2 font-mono text-sm"
                value={nationalityCode}
                onChange={(e) => setNationalityCode(e.target.value)}
              >
                {nationalities.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.code} — {n.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={busy !== null || !serviceId || !nationalityCode}>
              {busy === "elig-add" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Link
            </Button>
          </form>
        ) : null}
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">Nationality</th>
                {canWrite ? <th className="px-4 py-2 font-medium">Remove</th> : null}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {eligibility.map((e) => (
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
                        disabled={busy !== null}
                        aria-label="Remove eligibility"
                        onClick={() =>
                          void run(`elig-del-${e.serviceId}-${e.nationalityCode}`, async () => {
                            const res = await fetchApiEnvelope<{ deleted: unknown }>(
                              "/api/admin/catalog/eligibility",
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
                        {busy === `elig-del-${e.serviceId}-${e.nationalityCode}` ? (
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
        </div>
      </CardContent>
    </Card>
  );
}
