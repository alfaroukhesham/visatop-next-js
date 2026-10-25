"use client";

import type { FC } from "react";
import type { TAdminAnalyticsExpansion } from "@/lib/analytics/admin-analytics-expansion";
import type { TAnalyticsKpi } from "@/lib/analytics/admin-analytics-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface IKpiCardProps {
  title: string;
  value: string;
  hint: string;
}

const KpiCard: FC<IKpiCardProps> = ({ title, value, hint }) => (
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

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

const formatNumber = (n: number): string => numberFormat.format(n);

const formatDelta = (deltaPct: number | null): string => {
  if (deltaPct === null) return "n/a vs prior";
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${formatNumber(deltaPct)}% vs prior`;
};

const formatKpi = (kpi: TAnalyticsKpi, suffix = ""): { value: string; hint: string } => ({
  value: `${formatNumber(kpi.current)}${suffix}`,
  hint: formatDelta(kpi.deltaPct),
});

const formatSeconds = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${formatNumber(seconds)}s`;
  if (seconds < 3600) return `${formatNumber(seconds / 60)}m`;
  return `${formatNumber(seconds / 3600)}h`;
};

const formatHours = (hours: number | null): string => {
  if (hours === null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${formatNumber(hours * 60)}m`;
  if (hours < 48) return `${formatNumber(hours)}h`;
  return `${formatNumber(hours / 24)}d`;
};

const moneyList = (rows: { currency: string; amountMajor: number }[]): string => {
  if (rows.length === 0) return "0";
  return rows.map((row) => `${row.currency} ${formatNumber(row.amountMajor)}`).join(" · ");
};

interface ICountListProps {
  empty: string;
  rows: { key: string; left: string; right: string }[];
}

const CountList: FC<ICountListProps> = ({ empty, rows }) => {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }
  return (
    <ul className="divide-border divide-y text-sm">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
          <span>{row.left}</span>
          <span className="text-muted-foreground">{row.right}</span>
        </li>
      ))}
    </ul>
  );
};

interface IAdminAnalyticsObservabilityProps {
  data: TAdminAnalyticsExpansion;
}

export const AdminAnalyticsObservability: FC<IAdminAnalyticsObservabilityProps> = ({ data }) => {
  const webhookMatched = formatKpi(data.webhooks.matched);
  const webhookUnmatched = formatKpi(data.webhooks.unmatched);
  const stuck = formatKpi(data.stuckCheckouts.count);
  const ocrSuccess = formatKpi(data.ocr.successRatePct, "%");
  const refundsPending = formatKpi(data.refunds.pending);
  const cancelReset = formatKpi(data.cancelReset.auditedAbandons);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Webhook matched" value={webhookMatched.value} hint={webhookMatched.hint} />
        <KpiCard title="Webhook unmatched" value={webhookUnmatched.value} hint={webhookUnmatched.hint} />
        <KpiCard
          title={`Stuck checkouts (>${data.stuckCheckouts.thresholdMinutes}m)`}
          value={stuck.value}
          hint={`${stuck.hint} · pending lock as of range end`}
        />
        <KpiCard title="OCR success" value={ocrSuccess.value} hint={ocrSuccess.hint} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Refunds pending"
          value={refundsPending.value}
          hint={`${refundsPending.hint} · ${moneyList(data.refunds.pendingValue)}`}
        />
        <KpiCard
          title="Refunded"
          value={formatNumber(data.refunds.refunded.current)}
          hint={`${formatDelta(data.refunds.refunded.deltaPct)} · ${moneyList(data.refunds.refundedValue)}`}
        />
        <KpiCard
          title="Refunds initiated"
          value={formatNumber(data.refunds.initiatedAudits.current)}
          hint={formatDelta(data.refunds.initiatedAudits.deltaPct)}
        />
        <KpiCard
          title="Audited checkout abandons"
          value={cancelReset.value}
          hint={`${cancelReset.hint} · customer Cancel & Reset is not in audit_log`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Payments by provider</CardTitle>
          <CardDescription>
            Attempts are payment rows created in this range. Expired is counted from payment events
            (charge.expired / status expired) because payment.status has no expired value. Time-to-pay
            is checkout create → paid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.paymentsByProvider.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payment attempts in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs tracking-widest uppercase">
                    <th className="py-1.5 pr-3 font-medium">Provider</th>
                    <th className="py-1.5 pr-3 font-medium">Currency</th>
                    <th className="py-1.5 pr-3 font-medium">Attempts</th>
                    <th className="py-1.5 pr-3 font-medium">Paid</th>
                    <th className="py-1.5 pr-3 font-medium">Failed</th>
                    <th className="py-1.5 pr-3 font-medium">Expired</th>
                    <th className="py-1.5 pr-3 font-medium">Mismatch</th>
                    <th className="py-1.5 pr-3 font-medium">Conv.</th>
                    <th className="py-1.5 font-medium">Time to pay p50 / p95</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {data.paymentsByProvider.map((row) => (
                    <tr key={`${row.provider}-${row.currency}`}>
                      <td className="py-2 pr-3 font-medium">{row.provider}</td>
                      <td className="py-2 pr-3">{row.currency}</td>
                      <td className="py-2 pr-3">{formatNumber(row.attempts)}</td>
                      <td className="py-2 pr-3">{formatNumber(row.paid)}</td>
                      <td className="py-2 pr-3">{formatNumber(row.failed)}</td>
                      <td className="py-2 pr-3">{formatNumber(row.expired)}</td>
                      <td className="py-2 pr-3">{formatNumber(row.mismatch)}</td>
                      <td className="py-2 pr-3">{formatNumber(row.conversionPct)}%</td>
                      <td className="text-muted-foreground py-2">
                        {formatSeconds(row.timeToPaySeconds.p50)} / {formatSeconds(row.timeToPaySeconds.p95)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Webhook health</CardTitle>
            <CardDescription>
              Matched vs unmatched payment events, by provider, type, and status. Invalid signatures
              are rejected before insert, so the bad-signature count is usually 0.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-xs">
              Bad signatures this range: {formatNumber(data.webhooks.badSignatures.current)} (
              {formatDelta(data.webhooks.badSignatures.deltaPct)})
            </p>
            <CountList
              empty="No webhook events in this range."
              rows={data.webhooks.byType.map((row) => ({
                key: `${row.provider}-${row.type}-${row.status}`,
                left: `${row.provider} · ${row.type}${row.status ? ` · ${row.status}` : ""}`,
                right: formatNumber(row.count),
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fincra money checks</CardTitle>
            <CardDescription>
              Under / over / exact (variance type) with expected amount vs amount received and fees.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CountList
              empty="No Fincra payments in this range."
              rows={data.fincraMoney.byVariance.map((row) => ({
                key: row.varianceType,
                left: `${row.varianceType} · ${formatNumber(row.count)}`,
                right: `exp ${formatNumber(row.expectedMajor)} · recv ${formatNumber(row.receivedMajor)} · fee ${formatNumber(row.feeMajor)}`,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>OCR quality</CardTitle>
          <CardDescription>
            Extraction attempts in this range. Manual-edit rate uses provenance source=manual only —
            no field values.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Attempts"
              value={formatNumber(data.ocr.attempts.current)}
              hint={formatDelta(data.ocr.attempts.deltaPct)}
            />
            <KpiCard
              title="Failed"
              value={formatNumber(data.ocr.failed.current)}
              hint={formatDelta(data.ocr.failed.deltaPct)}
            />
            <KpiCard
              title="Latency p50 / p95"
              value={`${data.ocr.latencyMs.p50 === null ? "—" : `${formatNumber(data.ocr.latencyMs.p50)}ms`} / ${data.ocr.latencyMs.p95 === null ? "—" : `${formatNumber(data.ocr.latencyMs.p95)}ms`}`}
              hint={`${formatNumber(data.ocr.retryAttempts)} retry attempts · ${formatNumber(data.ocr.documentsRetried)} documents retried`}
            />
            <KpiCard
              title="Manual field edits"
              value={
                data.ocr.manualEdits.ratePct === null ? "—" : `${formatNumber(data.ocr.manualEdits.ratePct)}%`
              }
              hint={`${formatNumber(data.ocr.manualEdits.applicationsWithManualField)} / ${formatNumber(data.ocr.manualEdits.applicationsWithProvenance)} with provenance`}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
                Error codes
              </p>
              <CountList
                empty="No failed extractions in this range."
                rows={data.ocr.errorCodes.map((row) => ({
                  key: row.code,
                  left: row.code,
                  right: formatNumber(row.count),
                }))}
              />
            </div>
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
                Token usage by model
              </p>
              <CountList
                empty="No OCR token usage in this range."
                rows={data.ocr.tokensByModel.map((row) => ({
                  key: row.model,
                  left: `${row.model} · ${formatNumber(row.attempts)} attempts`,
                  right: `${formatNumber(row.promptTokens)} in / ${formatNumber(row.outputTokens)} out / ${formatNumber(row.totalTokens)} tot`,
                }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversion splits</CardTitle>
            <CardDescription>
              Applications created in this range. Paid uses payment status paid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
                Service / visa type
              </p>
              <CountList
                empty="No applications in this range."
                rows={data.conversionSplits.byService.map((row) => ({
                  key: `service-${row.key}`,
                  left: row.label,
                  right: `${formatNumber(row.created)} created · ${formatNumber(row.paid)} paid`,
                }))}
              />
            </div>
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
                Catalog currency
              </p>
              <CountList
                empty="No catalog-currency rows."
                rows={data.conversionSplits.byCatalogCurrency.map((row) => ({
                  key: `currency-${row.key}`,
                  left: row.label,
                  right: `${formatNumber(row.created)} created · ${formatNumber(row.paid)} paid`,
                }))}
              />
            </div>
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
                Guest vs signed-in
              </p>
              <CountList
                empty="No guest/signed-in split."
                rows={data.conversionSplits.byGuest.map((row) => ({
                  key: `guest-${row.key}`,
                  left: row.label === "guest" ? "Guest" : "Signed-in",
                  right: `${formatNumber(row.created)} created · ${formatNumber(row.paid)} paid`,
                }))}
              />
            </div>
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
                Adult vs child
              </p>
              <CountList
                empty="No traveller-kind split."
                rows={data.conversionSplits.byTravelerKind.map((row) => ({
                  key: `kind-${row.key}`,
                  left: row.label,
                  right: `${formatNumber(row.created)} created · ${formatNumber(row.paid)} paid`,
                }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Emails sent</CardTitle>
              <CardDescription>
                Transactional emails by kind. Recipients are not included.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CountList
                empty="No transactional emails in this range."
                rows={data.emailsByKind.map((row) => ({
                  key: row.kind,
                  left: row.kind,
                  right: formatNumber(row.count),
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Admin attention queue</CardTitle>
              <CardDescription>
                Live queue of applications flagged for attention. Age is time since last update.
                Flagged in range uses the selected period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-border divide-y text-sm">
                <li className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                  <span>Live queue</span>
                  <span className="text-muted-foreground">
                    {formatNumber(data.attentionQueue.size)} · oldest{" "}
                    {formatHours(data.attentionQueue.oldestAgeHours)} · median{" "}
                    {formatHours(data.attentionQueue.medianAgeHours)}
                  </span>
                </li>
                <li className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                  <span>Flagged in range</span>
                  <span className="text-muted-foreground">
                    {formatNumber(data.attentionQueue.flaggedInRange.current)} ·{" "}
                    {formatDelta(data.attentionQueue.flaggedInRange.deltaPct)}
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
