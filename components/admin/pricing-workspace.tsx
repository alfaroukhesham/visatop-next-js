"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { apiHref } from "@/lib/app-href";

export type MarginPolicyRow = {
  id: string;
  scope: string;
  serviceId: string | null;
  mode: string;
  value: string;
  currency: string;
  enabled: boolean;
};

export type ReferencePriceRow = {
  id: string;
  siteId: string;
  serviceId: string;
  serviceName: string;
  amount: number;
  currency: string;
  observedAt: string;
};

export type AffiliateSiteRow = { id: string; domain: string; enabled: boolean };
export type ServiceOption = { id: string; name: string };

type Props = {
  marginPolicies: MarginPolicyRow[];
  referencePrices: ReferencePriceRow[];
  services: ServiceOption[];
  sites: AffiliateSiteRow[];
  canRead: boolean;
  canWrite: boolean;
};

export function AdminPricingWorkspace({
  marginPolicies,
  referencePrices,
  services,
  sites,
  canRead,
  canWrite,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [refFilter, setRefFilter] = useState<string>("");

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

  const filteredRefs = useMemo(() => {
    if (!refFilter.trim()) return referencePrices;
    return referencePrices.filter((r) => r.serviceId === refFilter);
  }, [referencePrices, refFilter]);

  if (!canRead) {
    return (
      <p className="text-muted-foreground text-sm">
        Missing <span className="font-mono">pricing.read</span>.
      </p>
    );
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

      <MarginsCard
        rows={marginPolicies}
        services={services}
        canWrite={canWrite}
        busy={busy}
        run={run}
        flash={flash}
      />

      <Card className="border-border overflow-hidden border">
        <CardHeader className="border-border bg-muted/20 border-b">
          <CardTitle className="font-heading text-lg">Reference prices</CardTitle>
          <CardDescription>Observed affiliate amounts (minor units in the database).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="ref-filter" className="text-muted-foreground text-xs uppercase">
              Filter by service
            </Label>
            <select
              id="ref-filter"
              className="border-input bg-background h-9 max-w-md rounded-md border px-2 text-sm"
              value={refFilter}
              onChange={(e) => setRefFilter(e.target.value)}
            >
              <option value="">All services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {canWrite ? (
            <AddReferenceForm
              sites={sites}
              services={services}
              busy={busy}
              run={run}
              flash={flash}
            />
          ) : null}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 font-medium">Service</th>
                  <th className="px-4 py-2 font-medium">Site</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Observed</th>
                  {canWrite ? <th className="px-4 py-2 font-medium" /> : null}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {filteredRefs.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <span className="font-medium">{r.serviceName}</span>
                      <div className="text-muted-foreground font-mono text-[10px] break-all">{r.serviceId}</div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.siteId}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {(r.amount / 100).toFixed(2)} {r.currency}
                    </td>
                    <td className="text-muted-foreground px-4 py-2 font-mono text-[10px]">{r.observedAt}</td>
                    {canWrite ? (
                      <td className="px-4 py-2">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={busy !== null}
                          aria-label="Delete reference row"
                          onClick={() =>
                            void run(`ref-del-${r.id}`, async () => {
                              const res = await fetchApiEnvelope<{ deleted: { id: string } }>(
                                apiHref(`/admin/pricing/reference-prices/${encodeURIComponent(r.id)}`),
                                { method: "DELETE" },
                              );
                              if (!res.ok) {
                                flash(res.error.message, true);
                                throw new Error("fail");
                              }
                              flash("Deleted reference row.");
                            })
                          }
                        >
                          {busy === `ref-del-${r.id}` ? (
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
    </div>
  );
}

function MarginsCard({
  rows,
  services,
  canWrite,
  busy,
  run,
  flash,
}: {
  rows: MarginPolicyRow[];
  services: ServiceOption[];
  canWrite: boolean;
  busy: string | null;
  run: (k: string, fn: () => Promise<void>) => Promise<void>;
  flash: (t: string, err?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"global" | "service">("global");
  const [serviceId, setServiceId] = useState("");
  const [mode, setMode] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("20");
  const [currency, setCurrency] = useState("USD");

  return (
    <Card className="border-border overflow-hidden border">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 border-b border-border bg-muted/20">
        <div>
          <CardTitle className="font-heading text-lg">Margin policies</CardTitle>
          <CardDescription>Global default plus optional per-service overrides.</CardDescription>
        </div>
        {canWrite ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button type="button">New policy</Button>} />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New margin policy</DialogTitle>
                <DialogDescription>Percent is 0–100. Fixed is minor units (e.g. cents).</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="space-y-1">
                  <Label>Scope</Label>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={scope}
                    onChange={(e) => setScope(e.target.value as "global" | "service")}
                  >
                    <option value="global">Global</option>
                    <option value="service">Service</option>
                  </select>
                </div>
                {scope === "service" ? (
                  <div className="space-y-1">
                    <Label>Service</Label>
                    <select
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label>Mode</Label>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as "percent" | "fixed")}
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed (minor units)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="m-val">Value</Label>
                  <Input id="m-val" value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="m-ccy">Currency (ISO 4217)</Label>
                  <Input
                    id="m-ccy"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                    className="w-24 font-mono uppercase"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() =>
                    void run("margin-create", async () => {
                      const res = await fetchApiEnvelope<{ marginPolicy: MarginPolicyRow }>(
                        apiHref("/admin/pricing/margin-policies"),
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            scope,
                            serviceId: scope === "service" ? serviceId || null : null,
                            mode,
                            value,
                            currency,
                            enabled: true,
                          }),
                        },
                      );
                      if (!res.ok) {
                        flash(res.error.message, true);
                        throw new Error("fail");
                      }
                      flash("Margin policy created.");
                      setOpen(false);
                    })
                  }
                  disabled={
                    busy !== null || (scope === "service" && !serviceId) || !value.trim() || currency.length !== 3
                  }
                >
                  {busy === "margin-create" ? <Loader2 className="size-4 animate-spin" /> : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 font-medium">Scope</th>
                <th className="px-4 py-2 font-medium">Mode</th>
                <th className="px-4 py-2 font-medium">Value</th>
                <th className="px-4 py-2 font-medium">CCY</th>
                <th className="px-4 py-2 font-medium">On</th>
                {canWrite ? <th className="px-4 py-2 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{m.scope}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.mode}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.value}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.currency}</td>
                  <td className="px-4 py-2">{m.enabled ? "Yes" : "No"}</td>
                  {canWrite ? (
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy !== null}
                          onClick={() =>
                            void run(`margin-en-${m.id}`, async () => {
                              const res = await fetchApiEnvelope<{ marginPolicy: MarginPolicyRow }>(
                                apiHref(`/admin/pricing/margin-policies/${encodeURIComponent(m.id)}`),
                                {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ enabled: !m.enabled }),
                                },
                              );
                              if (!res.ok) {
                                flash(res.error.message, true);
                                throw new Error("fail");
                              }
                              flash("Updated policy.");
                            })
                          }
                        >
                          {busy === `margin-en-${m.id}` ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : m.enabled ? (
                            "Disable"
                          ) : (
                            "Enable"
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={busy !== null}
                          onClick={() =>
                            void run(`margin-del-${m.id}`, async () => {
                              const res = await fetchApiEnvelope<{ deleted: { id: string } }>(
                                apiHref(`/admin/pricing/margin-policies/${encodeURIComponent(m.id)}`),
                                { method: "DELETE" },
                              );
                              if (!res.ok) {
                                flash(res.error.message, true);
                                throw new Error("fail");
                              }
                              flash("Policy removed.");
                            })
                          }
                        >
                          {busy === `margin-del-${m.id}` ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
                        </Button>
                      </div>
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

function AddReferenceForm({
  sites,
  services,
  busy,
  run,
  flash,
}: {
  sites: AffiliateSiteRow[];
  services: ServiceOption[];
  busy: string | null;
  run: (k: string, fn: () => Promise<void>) => Promise<void>;
  flash: (t: string, err?: boolean) => void;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [majorAmount, setMajorAmount] = useState("145");
  const [currency, setCurrency] = useState("USD");

  return (
    <form
      className="border-border flex flex-wrap items-end gap-3 rounded-md border bg-muted/10 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run("ref-add", async () => {
          const n = Number.parseFloat(majorAmount.replace(",", "."));
          if (!Number.isFinite(n) || n < 0) {
            flash("Enter a valid amount.", true);
            return;
          }
          const amountMinor = Math.round(n * 100);
          const res = await fetchApiEnvelope<{ referencePrice: { id: string } }>(
            apiHref("/admin/pricing/reference-prices"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                siteId,
                serviceId,
                amount: amountMinor,
                currency,
              }),
            },
          );
          if (!res.ok) {
            flash(res.error.message, true);
            throw new Error("fail");
          }
          flash("Reference price recorded.");
        });
      }}
    >
      <div className="space-y-1">
        <Label>Affiliate site</Label>
        <select
          className="border-input bg-background h-9 min-w-[12rem] rounded-md border px-2 text-sm"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.domain}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label>Service</Label>
        <select
          className="border-input bg-background h-9 min-w-[12rem] rounded-md border px-2 text-sm"
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
        <Label htmlFor="ref-amt">Amount (major units)</Label>
        <Input
          id="ref-amt"
          inputMode="decimal"
          className="w-28 font-mono"
          value={majorAmount}
          onChange={(e) => setMajorAmount(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ref-ccy">CCY</Label>
        <Input
          id="ref-ccy"
          className="w-20 font-mono uppercase"
          maxLength={3}
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />
      </div>
      <Button type="submit" disabled={busy !== null || !siteId || !serviceId || currency.length !== 3}>
        {busy === "ref-add" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add observation
      </Button>
    </form>
  );
}
