"use client";

import type { FC } from "react";
import { conversionPctForDimension } from "@/lib/analytics/admin-analytics-conversion";
import { formatDurationSeconds } from "@/lib/analytics/admin-analytics-durations";
import type { TAdminAnalyticsPayload } from "@/lib/analytics/admin-analytics-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

const formatNumber = (n: number): string => numberFormat.format(n);

interface IDurationKpiProps {
  title: string;
  percentiles: TAdminAnalyticsPayload["durations"]["timeToPay"];
  hintWhenPresent: string;
  hintWhenEmpty: string;
}

const DurationKpi: FC<IDurationKpiProps> = ({ title, percentiles, hintWhenPresent, hintWhenEmpty }) => (
  <Card>
    <CardHeader>
      <CardDescription>{title}</CardDescription>
      <CardTitle className="text-2xl">
        {formatDurationSeconds(percentiles.p50Seconds)} p50 · {formatDurationSeconds(percentiles.p95Seconds)} p95
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground text-xs">
        {percentiles.sampleSize ? hintWhenPresent : hintWhenEmpty}
      </p>
    </CardContent>
  </Card>
);

interface ICountListCardProps {
  title: string;
  description: string;
  empty: string;
  labelClassName?: string;
  rows: Array<{ key: string; label: string; count: string }>;
}

const CountListCard: FC<ICountListCardProps> = ({ title, description, empty, labelClassName, rows }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <ul className="divide-border divide-y text-sm">
          {rows.map((row) => (
            <li key={row.key} className="flex justify-between py-2">
              <span className={labelClassName}>{row.label}</span>
              <span className="text-muted-foreground">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);

interface IAdminAnalyticsTrackingExtrasProps {
  data: TAdminAnalyticsPayload;
}

const conversionCount = (created: number, paid: number): string => {
  const pct = conversionPctForDimension(paid, created);
  return `${created} · ${paid} paid${pct === null ? "" : ` · ${formatNumber(pct)}%`}`;
};

export const AdminAnalyticsTrackingExtras: FC<IAdminAnalyticsTrackingExtrasProps> = ({ data }) => (
  <>
    <section className="grid gap-4 md:grid-cols-2">
      <DurationKpi
        title="Time to pay"
        percentiles={data.durations.timeToPay}
        hintWhenPresent={`${formatNumber(data.durations.timeToPay.sampleSize)} paid applications with a paid-at stamp`}
        hintWhenEmpty="Needs paid_at from the payment transition"
      />
      <DurationKpi
        title="Paid to fulfilled"
        percentiles={data.durations.paidToFulfilled}
        hintWhenPresent={`${formatNumber(data.durations.paidToFulfilled.sampleSize)} completed applications`}
        hintWhenEmpty="Needs fulfilled_at from the completed transition"
      />
    </section>
    <div className="grid gap-4 lg:grid-cols-3">
      <CountListCard
        title="Payment failures"
        description="Fincra expired/failed attempts and Ziina failed or canceled payments."
        empty="No payment failures in this range."
        rows={data.paymentFailures.map((row) => ({
          key: row.code,
          label: row.code,
          count: formatNumber(row.count),
        }))}
      />
      <CountListCard
        title="Conversion by country"
        description="Geo header when present, otherwise nationality. Unique funnel subjects."
        empty="No funnel events in this range."
        rows={data.conversionByCountry.map((row) => ({
          key: row.key,
          label: row.key,
          count: conversionCount(row.created, row.paid),
        }))}
      />
      <CountListCard
        title="Conversion by device"
        description="From the request User-Agent on the analytics beacon."
        empty="No funnel events in this range."
        labelClassName="capitalize"
        rows={data.conversionByDevice.map((row) => ({
          key: row.key,
          label: row.key,
          count: conversionCount(row.created, row.paid),
        }))}
      />
    </div>
  </>
);
