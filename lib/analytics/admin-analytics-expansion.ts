import { deltaPct } from "@/lib/analytics/analytics-range";
import type { TAnalyticsKpi } from "@/lib/analytics/admin-analytics-types";

/** Matches `FINCRA_OPEN_PAYMENT_STALE_MS` — pending checkouts older than this are stuck. */
export const STUCK_CHECKOUT_THRESHOLD_MS = 15 * 60 * 1000;

/** Customer Cancel & Reset is not written to `audit_log`; only this system abandon is. */
export const AUDITED_CANCEL_RESET_ACTIONS = ["payment_fincra_checkout_abandoned"] as const;

export const FINCRA_EXPIRED_EVENT_TYPE = "charge.expired";

const kpi = (current: number, previous: number): TAnalyticsKpi => ({
  current,
  previous,
  deltaPct: deltaPct(current, previous),
});

export const conversionPct = (paid: number, attempts: number): number => {
  if (attempts <= 0) return 0;
  return (paid / attempts) * 100;
};

export const isExpiredPaymentEvent = (event: { type: string; status: string | null }): boolean => {
  if (event.type === FINCRA_EXPIRED_EVENT_TYPE) return true;
  return (event.status ?? "").trim().toLowerCase() === "expired";
};

export const isAuditedCancelResetAction = (action: string): boolean =>
  (AUDITED_CANCEL_RESET_ACTIONS as readonly string[]).includes(action);

export const stuckCheckoutCutoff = (asOf: Date, thresholdMs = STUCK_CHECKOUT_THRESHOLD_MS): Date =>
  new Date(asOf.getTime() - thresholdMs);

export const ageHours = (updatedAt: Date, asOf: Date): number =>
  (asOf.getTime() - updatedAt.getTime()) / (60 * 60 * 1000);

const asFiniteNumber = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const percentile = (values: number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const weight = idx - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
};

export const median = (values: number[]): number | null => percentile(values, 0.5);

export const manualEditRatePct = (input: {
  withProvenance: number;
  withManualField: number;
}): number | null => {
  if (input.withProvenance <= 0) return null;
  return (input.withManualField / input.withProvenance) * 100;
};

export const ocrTokenUsageFromJson = (
  usage: unknown,
): { promptTokens: number; outputTokens: number; totalTokens: number } => {
  if (!usage || typeof usage !== "object") {
    return { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
  const record = usage as Record<string, unknown>;
  const promptTokens = asFiniteNumber(
    record.promptTokenCount ?? record.prompt_token_count ?? record.inputTokens,
  );
  const outputTokens = asFiniteNumber(
    record.candidatesTokenCount ?? record.candidates_token_count ?? record.outputTokenCount,
  );
  const totalRaw = asFiniteNumber(record.totalTokenCount ?? record.total_token_count);
  return {
    promptTokens,
    outputTokens,
    totalTokens: totalRaw > 0 ? totalRaw : promptTokens + outputTokens,
  };
};

export type TPaymentStatusCountRow = {
  provider: string;
  currency: string;
  status: string;
  count: number;
};

export type TExpiredCountRow = {
  provider: string;
  currency: string;
  count: number;
};

export type TTimeToPayRow = {
  provider: string;
  currency: string;
  avgSeconds: number | null;
  p50Seconds: number | null;
  p95Seconds: number | null;
};

export type TPaymentProviderAnalyticsRow = {
  provider: string;
  currency: string;
  attempts: number;
  paid: number;
  failed: number;
  expired: number;
  mismatch: number;
  conversionPct: number;
  timeToPaySeconds: { avg: number | null; p50: number | null; p95: number | null };
};

const providerCurrencyKey = (provider: string, currency: string): string =>
  `${provider}\0${currency}`;

export const buildPaymentsByProvider = (input: {
  statusCounts: TPaymentStatusCountRow[];
  expiredCounts: TExpiredCountRow[];
  timeToPay: TTimeToPayRow[];
}): TPaymentProviderAnalyticsRow[] => {
  const map = new Map<
    string,
    {
      provider: string;
      currency: string;
      attempts: number;
      paid: number;
      failed: number;
      expired: number;
      mismatch: number;
      timeToPaySeconds: TPaymentProviderAnalyticsRow["timeToPaySeconds"];
    }
  >();

  const ensure = (provider: string, currency: string) => {
    const key = providerCurrencyKey(provider, currency);
    const existing = map.get(key);
    if (existing) return existing;
    const created = {
      provider,
      currency,
      attempts: 0,
      paid: 0,
      failed: 0,
      expired: 0,
      mismatch: 0,
      timeToPaySeconds: { avg: null, p50: null, p95: null },
    };
    map.set(key, created);
    return created;
  };

  for (const row of input.statusCounts) {
    const bucket = ensure(row.provider, row.currency);
    const n = asFiniteNumber(row.count);
    bucket.attempts += n;
    if (row.status === "paid") bucket.paid += n;
    else if (row.status === "failed") bucket.failed += n;
    else if (row.status === "mismatch") bucket.mismatch += n;
  }

  for (const row of input.expiredCounts) {
    const bucket = ensure(row.provider, row.currency);
    bucket.expired += asFiniteNumber(row.count);
  }

  for (const row of input.timeToPay) {
    const bucket = ensure(row.provider, row.currency);
    bucket.timeToPaySeconds = {
      avg: row.avgSeconds,
      p50: row.p50Seconds,
      p95: row.p95Seconds,
    };
  }

  return [...map.values()]
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.currency.localeCompare(b.currency))
    .map((row) => ({
      ...row,
      conversionPct: conversionPct(row.paid, row.attempts),
    }));
};

export type TWebhookCountRow = {
  provider: string | null;
  type: string;
  status: string | null;
  matched: boolean;
  signatureValid: boolean;
  count: number;
};

export type TWebhookTypeRow = {
  provider: string;
  type: string;
  status: string;
  count: number;
};

export type TWebhookHealthSummary = {
  matched: TAnalyticsKpi;
  unmatched: TAnalyticsKpi;
  badSignatures: TAnalyticsKpi;
  byType: TWebhookTypeRow[];
};

const webhookTotals = (rows: TWebhookCountRow[]) => {
  let matched = 0;
  let unmatched = 0;
  let badSignatures = 0;
  for (const row of rows) {
    const n = asFiniteNumber(row.count);
    if (row.matched) matched += n;
    else unmatched += n;
    if (!row.signatureValid) badSignatures += n;
  }
  return { matched, unmatched, badSignatures };
};

export const summarizeWebhookHealth = (
  current: TWebhookCountRow[],
  previous: TWebhookCountRow[],
): TWebhookHealthSummary => {
  const cur = webhookTotals(current);
  const prev = webhookTotals(previous);
  const byTypeMap = new Map<string, TWebhookTypeRow>();
  for (const row of current) {
    const provider = row.provider?.trim() || "unknown";
    const status = row.status ?? "";
    const key = `${provider}\0${row.type}\0${status}`;
    const existing = byTypeMap.get(key);
    const n = asFiniteNumber(row.count);
    if (existing) existing.count += n;
    else byTypeMap.set(key, { provider, type: row.type, status, count: n });
  }
  const byType = [...byTypeMap.values()].sort(
    (a, b) =>
      a.provider.localeCompare(b.provider) ||
      a.type.localeCompare(b.type) ||
      a.status.localeCompare(b.status),
  );
  return {
    matched: kpi(cur.matched, prev.matched),
    unmatched: kpi(cur.unmatched, prev.unmatched),
    badSignatures: kpi(cur.badSignatures, prev.badSignatures),
    byType,
  };
};

export type TMoneyByCurrency = {
  currency: string;
  amountMinor: string;
  amountMajor: number;
};

export type TConversionSplitRow = {
  key: string;
  label: string;
  created: number;
  paid: number;
};

export type TFincraVarianceRow = {
  varianceType: string;
  count: number;
  expectedMinor: string;
  receivedMinor: string;
  feeMinor: string;
  expectedMajor: number;
  receivedMajor: number;
  feeMajor: number;
};

export type TOcrErrorCodeRow = { code: string; count: number };

export type TOcrTokenModelRow = {
  model: string;
  attempts: number;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type TEmailKindRow = { kind: string; count: number };

export type TAdminAnalyticsExpansion = {
  paymentsByProvider: TPaymentProviderAnalyticsRow[];
  webhooks: TWebhookHealthSummary;
  fincraMoney: { byVariance: TFincraVarianceRow[] };
  refunds: {
    pending: TAnalyticsKpi;
    refunded: TAnalyticsKpi;
    pendingValue: TMoneyByCurrency[];
    refundedValue: TMoneyByCurrency[];
    initiatedAudits: TAnalyticsKpi;
  };
  stuckCheckouts: {
    count: TAnalyticsKpi;
    thresholdMinutes: number;
  };
  cancelReset: {
    auditedAbandons: TAnalyticsKpi;
    customerCancelNotAudited: true;
  };
  ocr: {
    attempts: TAnalyticsKpi;
    succeeded: TAnalyticsKpi;
    failed: TAnalyticsKpi;
    successRatePct: TAnalyticsKpi;
    errorCodes: TOcrErrorCodeRow[];
    latencyMs: { p50: number | null; p95: number | null };
    retryAttempts: number;
    documentsRetried: number;
    tokensByModel: TOcrTokenModelRow[];
    manualEdits: {
      applicationsWithProvenance: number;
      applicationsWithManualField: number;
      ratePct: number | null;
    };
  };
  conversionSplits: {
    byService: TConversionSplitRow[];
    byCatalogCurrency: TConversionSplitRow[];
    byGuest: TConversionSplitRow[];
    byTravelerKind: TConversionSplitRow[];
  };
  emailsByKind: TEmailKindRow[];
  attentionQueue: {
    size: number;
    flaggedInRange: TAnalyticsKpi;
    oldestAgeHours: number | null;
    medianAgeHours: number | null;
  };
};

const emptyKpi = (): TAnalyticsKpi => kpi(0, 0);

export const emptyAdminAnalyticsExpansion = (): TAdminAnalyticsExpansion => ({
  paymentsByProvider: [],
  webhooks: {
    matched: emptyKpi(),
    unmatched: emptyKpi(),
    badSignatures: emptyKpi(),
    byType: [],
  },
  fincraMoney: { byVariance: [] },
  refunds: {
    pending: emptyKpi(),
    refunded: emptyKpi(),
    pendingValue: [],
    refundedValue: [],
    initiatedAudits: emptyKpi(),
  },
  stuckCheckouts: {
    count: emptyKpi(),
    thresholdMinutes: STUCK_CHECKOUT_THRESHOLD_MS / 60000,
  },
  cancelReset: {
    auditedAbandons: emptyKpi(),
    customerCancelNotAudited: true,
  },
  ocr: {
    attempts: emptyKpi(),
    succeeded: emptyKpi(),
    failed: emptyKpi(),
    successRatePct: emptyKpi(),
    errorCodes: [],
    latencyMs: { p50: null, p95: null },
    retryAttempts: 0,
    documentsRetried: 0,
    tokensByModel: [],
    manualEdits: {
      applicationsWithProvenance: 0,
      applicationsWithManualField: 0,
      ratePct: null,
    },
  },
  conversionSplits: {
    byService: [],
    byCatalogCurrency: [],
    byGuest: [],
    byTravelerKind: [],
  },
  emailsByKind: [],
  attentionQueue: {
    size: 0,
    flaggedInRange: emptyKpi(),
    oldestAgeHours: null,
    medianAgeHours: null,
  },
});
