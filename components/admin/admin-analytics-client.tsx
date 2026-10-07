"use client";

import { useEffect, useMemo, useState, type FC } from "react";
import { apiHref } from "@/lib/app-href";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import type { TAdminAnalyticsPayload } from "@/lib/analytics/admin-analytics-types";
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
import { cn } from "@/lib/utils";
import { AdminLoadingMessage } from "@/components/admin/admin-loading";

type TPreset = "7d" | "today" | "mtd" | "ytd" | "custom";

const startOfLocalDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const rangeForPreset = (preset: TPreset, now = new Date()): { from: Date; to: Date } => {
  if (preset === "today") return { from: startOfLocalDay(now), to: now };
  if (preset === "mtd") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  if (preset === "ytd") return { from: new Date(now.getFullYear(), 0, 1), to: now };
  return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
};

const toDatetimeLocalValue = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatNumber = (n: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);

const formatDelta = (deltaPct: number | null): string => {
  if (deltaPct === null) return "n/a vs prior";
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${formatNumber(deltaPct)}% vs prior`;
};

const formatLastPaid = (iso: string | null): string => {
  if (!iso) return "No paid application yet";
  const at = new Date(iso);
  const days = Math.max(0, Math.floor((Date.now() - at.getTime()) / (24 * 60 * 60 * 1000)));
  const abs = at.toLocaleString();
  if (days === 0) return `Today (${abs})`;
  if (days === 1) return `1 day ago (${abs})`;
  return `${days} days ago (${abs})`;
};

const formatShownRange = (fromIso: string, toIso: string): string => {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return `${from.toLocaleString()} → ${to.toLocaleString()}`;
};

const KpiCard: FC<{ title: string; value: string; hint: string }> = ({ title, value, hint }) => (
  <Card>
    <CardHeader>
      <CardDescription>{title}</CardDescription>
      <CardTitle className="text-2xl">{value}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </CardContent>
  </Card>
);

interface IAnalyticsResultsFrameProps {
  loading: boolean;
  hasData: boolean;
  children: React.ReactNode;
}

const AnalyticsResultsFrame: FC<IAnalyticsResultsFrameProps> = ({ loading, hasData, children }) => {
  const busy = loading && hasData;
  return (
    <div className="relative" aria-busy={loading || undefined}>
      {busy ? <div className="app-table-progress" aria-hidden /> : null}
      {busy ? (
        <div className="bg-background/75 absolute inset-0 z-10 flex items-start justify-center pt-16">
          <AdminLoadingMessage label="Updating analytics…" className="py-3" />
        </div>
      ) : null}
      <div className={cn("space-y-8", busy && "pointer-events-none opacity-50")}>{children}</div>
    </div>
  );
};

export const AdminAnalyticsClient: FC = () => {
  const [preset, setPreset] = useState<TPreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<TAdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (preset === "custom") {
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo) : null;
      if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
      return { from, to };
    }
    return rangeForPreset(preset);
  }, [preset, customFrom, customTo]);

  const query = range
    ? `?from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`
    : "";

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetchApiEnvelope<TAdminAnalyticsPayload>(
          apiHref(`/admin/analytics${query}`),
          { cache: "no-store", signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setError(res.error.message);
          setLoading(false);
          return;
        }
        setError(null);
        setData(res.data);
        setLoading(false);
      } catch {
        if (controller.signal.aborted) return;
        setError("Could not load analytics");
        setLoading(false);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [query]);

  const onPreset = (next: TPreset) => {
    if (next !== preset) setLoading(true);
    setPreset(next);
    if (next === "custom" && !customFrom && !customTo) {
      const r = rangeForPreset("7d");
      setCustomFrom(toDatetimeLocalValue(r.from));
      setCustomTo(toDatetimeLocalValue(r.to));
    }
  };

  const fetching = Boolean(query) && loading;

  const maxWeekly = Math.max(1, ...(data?.weekly.map((w) => Math.max(w.created, w.paid)) ?? [1]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">Range</p>
          {range ? (
            <p className="text-muted-foreground text-xs">
              {fetching && data
                ? `Updating ${range.from.toLocaleString()} → ${range.to.toLocaleString()}`
                : data
                  ? `Showing ${formatShownRange(data.range.from, data.range.to)}`
                  : `Requested ${range.from.toLocaleString()} → ${range.to.toLocaleString()}`}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {(["7d", "today", "mtd", "ytd", "custom"] as const).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={preset === key ? "default" : "outline"}
                onClick={() => onPreset(key)}
              >
                {key === "7d" ? "7 days" : key === "today" ? "Today" : key === "mtd" ? "MTD" : key === "ytd" ? "YTD" : "Custom"}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={cn("inline-flex")} href={query ? apiHref(`/admin/analytics/export${query}&kind=summary`) : undefined}>
            <Button type="button" variant="outline" size="sm" disabled={!query}>
              Export summary CSV
            </Button>
          </a>
          <a href={query ? apiHref(`/admin/analytics/export${query}&kind=events`) : undefined}>
            <Button type="button" variant="outline" size="sm" disabled={!query}>
              Export events CSV
            </Button>
          </a>
          <a href={query ? apiHref(`/admin/analytics/export${query}&kind=applicants`) : undefined}>
            <Button type="button" variant="outline" size="sm" disabled={!query}>
              Export applicants CSV
            </Button>
          </a>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Applicants CSV includes contact emails. Summary and events CSVs do not.
      </p>

      {preset === "custom" ? (
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="analytics-from">From</Label>
            <Input
              id="analytics-from"
              type="datetime-local"
              value={customFrom}
              onChange={(e) => {
                setLoading(true);
                setCustomFrom(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="analytics-to">To</Label>
            <Input
              id="analytics-to"
              type="datetime-local"
              value={customTo}
              onChange={(e) => {
                setLoading(true);
                setCustomTo(e.target.value);
              }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {fetching && !data ? <AdminLoadingMessage label="Loading analytics…" /> : null}

      {data ? (
        <AnalyticsResultsFrame loading={fetching} hasData={true}>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Applications created"
              value={formatNumber(data.kpis.applicationsCreated.current)}
              hint={formatDelta(data.kpis.applicationsCreated.deltaPct)}
            />
            <KpiCard
              title="Paid"
              value={formatNumber(data.kpis.paid.current)}
              hint={formatDelta(data.kpis.paid.deltaPct)}
            />
            <KpiCard
              title="Revenue"
              value={
                data.revenue.length === 0
                  ? "0"
                  : data.revenue.map((r) => `${r.currency} ${formatNumber(r.amountMajor)}`).join(" · ")
              }
              hint="Paid amount in the range, by currency"
            />
            <KpiCard title="Last paid application" value={formatLastPaid(data.kpis.lastPaidAt)} hint="Global, not filtered by range" />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard
              title="Overall abandon"
              value={data.churn.overallAbandonPct === null ? "—" : `${formatNumber(data.churn.overallAbandonPct)}%`}
              hint="1 − (paid ÷ created) in this range"
            />
            <KpiCard
              title="Biggest drop-off"
              value={
                data.churn.biggestDrop
                  ? `${data.churn.biggestDrop.label} (${formatNumber(data.churn.biggestDrop.dropPct)}%)`
                  : "—"
              }
              hint={
                data.churn.biggestDrop
                  ? `${data.churn.biggestDrop.fromCount} → ${data.churn.biggestDrop.toCount}`
                  : "Not enough funnel data"
              }
            />
            <KpiCard
              title="Abandoned (unpaid)"
              value={formatNumber(data.churn.abandonedDrafts)}
              hint="Created in range and still unpaid"
            />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Funnel</CardTitle>
              <CardDescription>
                Unique sessions before an application exists, unique applications after. Conversion created→paid:{" "}
                {formatNumber(data.kpis.conversionPct.current)}%.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.funnel.every((s) => s.count === 0) ? (
                <p className="text-muted-foreground text-sm">No funnel events in this range.</p>
              ) : null}
              <ul className="divide-border divide-y">
                {data.funnel.map((step) => (
                  <li key={step.eventName} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <span className="font-medium">{step.label}</span>
                    <span className="text-muted-foreground text-sm">
                      {formatNumber(step.count)}
                      {step.dropPct !== null ? ` · lost ${formatNumber(step.dropPct)}%` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
                  Where unpaid applications stop
                </p>
                <ul className="divide-border divide-y">
                  {data.stops.map((stop) => (
                    <li key={stop.screen} className="flex items-baseline justify-between gap-2 py-1.5 text-sm">
                      <span>{stop.label}</span>
                      <span className="text-muted-foreground">{formatNumber(stop.count)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {data.passportFailures.length > 0 ? (
                <div className="mt-6">
                  <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
                    Passport upload failures
                  </p>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    {data.passportFailures.map((row) => (
                      <li key={row.code}>
                        {row.code}: {formatNumber(row.count)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.extraSteps.some((s) => s.count > 0) ? (
                <div className="mt-6">
                  <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
                    Other steps
                  </p>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    {data.extraSteps.map((s) => (
                      <li key={s.eventName}>
                        {s.label}: {formatNumber(s.count)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Weekly volume</CardTitle>
                <CardDescription>Created vs paid by UTC week (Monday). Labels follow your browser timezone.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.weekly.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No volume in this range.</p>
                ) : (
                  data.weekly.map((week) => (
                    <div key={week.weekStart} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{new Date(`${week.weekStart}T00:00:00.000Z`).toLocaleDateString()}</span>
                        <span>
                          {week.created} created · {week.paid} paid
                        </span>
                      </div>
                      <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full"
                          style={{ width: `${(week.created / maxWeekly) * 100}%` }}
                        />
                      </div>
                      <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-foreground/50 h-full"
                          style={{ width: `${(week.paid / maxWeekly) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top nationalities</CardTitle>
                <CardDescription>Applications created in this range.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.nationalities.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No applications in this range.</p>
                ) : (
                  <ul className="divide-border divide-y text-sm">
                    {data.nationalities.map((n) => (
                      <li key={n.code} className="flex justify-between py-2">
                        <span>
                          {n.name} ({n.code})
                        </span>
                        <span className="text-muted-foreground">
                          {n.created} created · {n.paid} paid
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </AnalyticsResultsFrame>
      ) : null}
    </div>
  );
};
