import { and, eq, gte, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  application,
  applicationDocumentExtraction,
  auditLog,
  payment,
  paymentEvent,
  transactionalEmailSent,
  visaService,
} from "@/lib/db/schema";
import { previousPeriod, type TInstantRange } from "@/lib/analytics/analytics-range";
import { deltaPct } from "@/lib/analytics/analytics-range";
import { minorUnitsToJsonSafeNumber } from "@/lib/pricing/minor-units-json";
import {
  AUDITED_CANCEL_RESET_ACTIONS,
  STUCK_CHECKOUT_THRESHOLD_MS,
  buildPaymentsByProvider,
  conversionPct,
  emptyAdminAnalyticsExpansion,
  isExpiredPaymentEvent,
  manualEditRatePct,
  stuckCheckoutCutoff,
  summarizeWebhookHealth,
  type TAdminAnalyticsExpansion,
  type TConversionSplitRow,
  type TEmailKindRow,
  type TExpiredCountRow,
  type TFincraVarianceRow,
  type TMoneyByCurrency,
  type TOcrErrorCodeRow,
  type TOcrTokenModelRow,
  type TPaymentStatusCountRow,
  type TTimeToPayRow,
  type TWebhookCountRow,
} from "@/lib/analytics/admin-analytics-expansion";
import type { TAnalyticsKpi } from "@/lib/analytics/admin-analytics-types";

const kpi = (current: number, previous: number): TAnalyticsKpi => ({
  current,
  previous,
  deltaPct: deltaPct(current, previous),
});

const asInt = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const inRange = (column: Parameters<typeof gte>[0], range: TInstantRange) =>
  and(gte(column, range.from), lt(column, range.to));

const toMoney = (currency: string | null, amountMinor: string | null): TMoneyByCurrency => {
  const minor = BigInt(amountMinor ?? "0");
  return {
    currency: (currency ?? "").trim() || "UNKNOWN",
    amountMinor: minor.toString(),
    amountMajor: minorUnitsToJsonSafeNumber(minor) / 100,
  };
};

const toMajor = (amountMinor: string | null): { minor: string; major: number } => {
  const minor = BigInt(amountMinor ?? "0");
  return { minor: minor.toString(), major: minorUnitsToJsonSafeNumber(minor) / 100 };
};

const splitRows = (
  rows: { key: string | boolean | null; label: string | null; created: number; paid: number }[],
): TConversionSplitRow[] =>
  rows.map((row) => ({
    key: String(row.key ?? ""),
    label: row.label ?? String(row.key ?? ""),
    created: asInt(row.created),
    paid: asInt(row.paid),
  }));

const countByPeriod = (
  rows: { current: number; previous: number }[],
): { current: number; previous: number } =>
  rows.reduce(
    (acc, row) => ({
      current: acc.current + asInt(row.current),
      previous: acc.previous + asInt(row.previous),
    }),
    { current: 0, previous: 0 },
  );

export const loadAdminAnalyticsExpansion = async (
  tx: DbTransaction,
  range: TInstantRange,
): Promise<TAdminAnalyticsExpansion> => {
  const prev = previousPeriod(range);
  const stuckCutoff = stuckCheckoutCutoff(range.to);
  const stuckCutoffPrev = stuckCheckoutCutoff(prev.to);
  const empty = emptyAdminAnalyticsExpansion();

  const [
    paymentStatusRows,
    expiredRows,
    timeToPayRows,
    webhookRows,
    fincraRows,
    refundCountRows,
    refundValueRows,
    refundAuditRows,
    stuckRows,
    cancelRows,
    ocrStatusRows,
    ocrErrorRows,
    ocrLatencyRows,
    ocrRetryRows,
    ocrTokenRows,
    manualEditRows,
    serviceSplitRows,
    currencySplitRows,
    guestSplitRows,
    travelerSplitRows,
    emailRows,
    attentionLiveRows,
    attentionRangeRows,
  ] = await Promise.all([
    tx
      .select({
        provider: payment.provider,
        currency: payment.currency,
        status: payment.status,
        count: sql<number>`cast(count(*) filter (where ${payment.createdAt} >= ${range.from} and ${payment.createdAt} < ${range.to}) as int)`,
      })
      .from(payment)
      .groupBy(payment.provider, payment.currency, payment.status),
    tx
      .select({
        provider: sql<string>`coalesce(${paymentEvent.provider}, ${payment.provider}, 'unknown')`,
        currency: sql<string>`coalesce(${payment.currency}, '')`,
        type: paymentEvent.type,
        status: paymentEvent.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(paymentEvent)
      .leftJoin(payment, eq(payment.id, paymentEvent.paymentId))
      .where(inRange(paymentEvent.receivedAt, range)),
    tx
      .select({
        provider: payment.provider,
        currency: payment.currency,
        avgSeconds: sql<number | null>`avg(extract(epoch from (${payment.updatedAt} - ${payment.createdAt})))`,
        p50Seconds: sql<
          number | null
        >`percentile_cont(0.5) within group (order by extract(epoch from (${payment.updatedAt} - ${payment.createdAt})))`,
        p95Seconds: sql<
          number | null
        >`percentile_cont(0.95) within group (order by extract(epoch from (${payment.updatedAt} - ${payment.createdAt})))`,
      })
      .from(payment)
      .where(and(eq(payment.status, "paid"), inRange(payment.updatedAt, range)))
      .groupBy(payment.provider, payment.currency),
    tx
      .select({
        provider: paymentEvent.provider,
        type: paymentEvent.type,
        status: paymentEvent.status,
        matched: paymentEvent.matched,
        signatureValid: paymentEvent.signatureValid,
        current: sql<number>`cast(count(*) filter (where ${paymentEvent.receivedAt} >= ${range.from} and ${paymentEvent.receivedAt} < ${range.to}) as int)`,
        previous: sql<number>`cast(count(*) filter (where ${paymentEvent.receivedAt} >= ${prev.from} and ${paymentEvent.receivedAt} < ${prev.to}) as int)`,
      })
      .from(paymentEvent)
      .groupBy(
        paymentEvent.provider,
        paymentEvent.type,
        paymentEvent.status,
        paymentEvent.matched,
        paymentEvent.signatureValid,
      ),
    tx
      .select({
        varianceType: sql<string>`coalesce(${payment.varianceType}, 'unspecified')`,
        count: sql<number>`cast(count(*) as int)`,
        expectedMinor: sql<string>`cast(coalesce(sum(${payment.amount}), 0) as text)`,
        receivedMinor: sql<string>`cast(coalesce(sum(${payment.amountReceivedMinor}), 0) as text)`,
        feeMinor: sql<string>`cast(coalesce(sum(${payment.feeMinor}), 0) as text)`,
      })
      .from(payment)
      .where(and(eq(payment.provider, "fincra"), inRange(payment.updatedAt, range)))
      .groupBy(sql`coalesce(${payment.varianceType}, 'unspecified')`),
    tx
      .select({
        paymentStatus: application.paymentStatus,
        current: sql<number>`cast(count(*) filter (where ${application.updatedAt} >= ${range.from} and ${application.updatedAt} < ${range.to}) as int)`,
        previous: sql<number>`cast(count(*) filter (where ${application.updatedAt} >= ${prev.from} and ${application.updatedAt} < ${prev.to}) as int)`,
      })
      .from(application)
      .where(inArray(application.paymentStatus, ["refund_pending", "refunded"]))
      .groupBy(application.paymentStatus),
    tx
      .select({
        paymentStatus: application.paymentStatus,
        currency: payment.currency,
        amountMinor: sql<string>`cast(coalesce(sum(${payment.amount}), 0) as text)`,
      })
      .from(application)
      .innerJoin(payment, eq(payment.applicationId, application.id))
      .where(
        and(
          inArray(application.paymentStatus, ["refund_pending", "refunded"]),
          inRange(application.updatedAt, range),
          eq(payment.status, "paid"),
        ),
      )
      .groupBy(application.paymentStatus, payment.currency),
    tx
      .select({
        current: sql<number>`cast(count(*) filter (where ${auditLog.createdAt} >= ${range.from} and ${auditLog.createdAt} < ${range.to}) as int)`,
        previous: sql<number>`cast(count(*) filter (where ${auditLog.createdAt} >= ${prev.from} and ${auditLog.createdAt} < ${prev.to}) as int)`,
      })
      .from(auditLog)
      .where(eq(auditLog.action, "application.refund.initiate")),
    tx
      .select({
        current: sql<number>`cast(count(*) filter (where ${application.updatedAt} < ${stuckCutoff}) as int)`,
        previous: sql<number>`cast(count(*) filter (where ${application.updatedAt} < ${stuckCutoffPrev}) as int)`,
      })
      .from(application)
      .where(and(eq(application.checkoutState, "pending"), ne(application.paymentStatus, "paid"))),
    tx
      .select({
        current: sql<number>`cast(count(*) filter (where ${auditLog.createdAt} >= ${range.from} and ${auditLog.createdAt} < ${range.to}) as int)`,
        previous: sql<number>`cast(count(*) filter (where ${auditLog.createdAt} >= ${prev.from} and ${auditLog.createdAt} < ${prev.to}) as int)`,
      })
      .from(auditLog)
      .where(inArray(auditLog.action, [...AUDITED_CANCEL_RESET_ACTIONS])),
    tx
      .select({
        status: applicationDocumentExtraction.status,
        current: sql<number>`cast(count(*) filter (where ${applicationDocumentExtraction.startedAt} >= ${range.from} and ${applicationDocumentExtraction.startedAt} < ${range.to}) as int)`,
        previous: sql<number>`cast(count(*) filter (where ${applicationDocumentExtraction.startedAt} >= ${prev.from} and ${applicationDocumentExtraction.startedAt} < ${prev.to}) as int)`,
      })
      .from(applicationDocumentExtraction)
      .groupBy(applicationDocumentExtraction.status),
    tx
      .select({
        code: sql<string>`coalesce(${applicationDocumentExtraction.errorCode}, 'unspecified')`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(applicationDocumentExtraction)
      .where(
        and(eq(applicationDocumentExtraction.status, "failed"), inRange(applicationDocumentExtraction.startedAt, range)),
      )
      .groupBy(sql`coalesce(${applicationDocumentExtraction.errorCode}, 'unspecified')`),
    tx
      .select({
        p50: sql<number | null>`percentile_cont(0.5) within group (order by ${applicationDocumentExtraction.latencyMs})`,
        p95: sql<number | null>`percentile_cont(0.95) within group (order by ${applicationDocumentExtraction.latencyMs})`,
      })
      .from(applicationDocumentExtraction)
      .where(
        and(isNotNull(applicationDocumentExtraction.latencyMs), inRange(applicationDocumentExtraction.startedAt, range)),
      ),
    tx
      .select({
        retryAttempts: sql<number>`cast(count(*) filter (where ${applicationDocumentExtraction.attempt} > 1) as int)`,
        documentsRetried: sql<number>`cast(count(distinct ${applicationDocumentExtraction.documentId}) filter (where ${applicationDocumentExtraction.attempt} > 1) as int)`,
      })
      .from(applicationDocumentExtraction)
      .where(inRange(applicationDocumentExtraction.startedAt, range)),
    tx
      .select({
        model: sql<string>`coalesce(${applicationDocumentExtraction.model}, 'unknown')`,
        attempts: sql<number>`cast(count(*) as int)`,
        promptTokens: sql<number>`cast(coalesce(sum(coalesce((${applicationDocumentExtraction.usage}->>'promptTokenCount')::int, (${applicationDocumentExtraction.usage}->>'prompt_token_count')::int, 0)), 0) as int)`,
        outputTokens: sql<number>`cast(coalesce(sum(coalesce((${applicationDocumentExtraction.usage}->>'candidatesTokenCount')::int, (${applicationDocumentExtraction.usage}->>'candidates_token_count')::int, 0)), 0) as int)`,
        totalTokens: sql<number>`cast(coalesce(sum(coalesce((${applicationDocumentExtraction.usage}->>'totalTokenCount')::int, (${applicationDocumentExtraction.usage}->>'total_token_count')::int, 0)), 0) as int)`,
      })
      .from(applicationDocumentExtraction)
      .where(inRange(applicationDocumentExtraction.startedAt, range))
      .groupBy(sql`coalesce(${applicationDocumentExtraction.model}, 'unknown')`),
    tx
      .select({
        withProvenance: sql<number>`cast(count(*) filter (where ${application.applicantProfileProvenanceJson} is not null) as int)`,
        withManualField: sql<number>`cast(count(*) filter (
          where ${application.applicantProfileProvenanceJson} is not null
            and exists (
              select 1
              from jsonb_each(${application.applicantProfileProvenanceJson}) kv
              where kv.value->>'source' = 'manual'
            )
        ) as int)`,
      })
      .from(application)
      .where(inRange(application.createdAt, range)),
    tx
      .select({
        key: visaService.id,
        label: visaService.name,
        created: sql<number>`cast(count(*) as int)`,
        paid: sql<number>`cast(count(*) filter (where ${application.paymentStatus} = 'paid') as int)`,
      })
      .from(application)
      .innerJoin(visaService, eq(visaService.id, application.serviceId))
      .where(inRange(application.createdAt, range))
      .groupBy(visaService.id, visaService.name)
      .orderBy(sql`count(*) desc`),
    tx
      .select({
        key: application.catalogCurrency,
        label: application.catalogCurrency,
        created: sql<number>`cast(count(*) as int)`,
        paid: sql<number>`cast(count(*) filter (where ${application.paymentStatus} = 'paid') as int)`,
      })
      .from(application)
      .where(inRange(application.createdAt, range))
      .groupBy(application.catalogCurrency)
      .orderBy(sql`count(*) desc`),
    tx
      .select({
        key: application.isGuest,
        label: sql<string>`case when ${application.isGuest} then 'guest' else 'signed_in' end`,
        created: sql<number>`cast(count(*) as int)`,
        paid: sql<number>`cast(count(*) filter (where ${application.paymentStatus} = 'paid') as int)`,
      })
      .from(application)
      .where(inRange(application.createdAt, range))
      .groupBy(application.isGuest),
    tx
      .select({
        key: application.travelerKind,
        label: application.travelerKind,
        created: sql<number>`cast(count(*) as int)`,
        paid: sql<number>`cast(count(*) filter (where ${application.paymentStatus} = 'paid') as int)`,
      })
      .from(application)
      .where(inRange(application.createdAt, range))
      .groupBy(application.travelerKind)
      .orderBy(sql`count(*) desc`),
    tx
      .select({
        kind: transactionalEmailSent.kind,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(transactionalEmailSent)
      .where(inRange(transactionalEmailSent.createdAt, range))
      .groupBy(transactionalEmailSent.kind)
      .orderBy(sql`count(*) desc`),
    tx
      .select({
        size: sql<number>`cast(count(*) as int)`,
        oldestAgeHours: sql<
          number | null
        >`min(extract(epoch from (now() - ${application.updatedAt})) / 3600.0)`,
        medianAgeHours: sql<
          number | null
        >`percentile_cont(0.5) within group (order by extract(epoch from (now() - ${application.updatedAt})) / 3600.0)`,
      })
      .from(application)
      .where(eq(application.adminAttentionRequired, true)),
    tx
      .select({
        current: sql<number>`cast(count(*) filter (where ${application.updatedAt} >= ${range.from} and ${application.updatedAt} < ${range.to}) as int)`,
        previous: sql<number>`cast(count(*) filter (where ${application.updatedAt} >= ${prev.from} and ${application.updatedAt} < ${prev.to}) as int)`,
      })
      .from(application)
      .where(eq(application.adminAttentionRequired, true)),
  ]);

  const statusCounts: TPaymentStatusCountRow[] = paymentStatusRows
    .filter((row) => asInt(row.count) > 0)
    .map((row) => ({
      provider: row.provider,
      currency: row.currency,
      status: row.status,
      count: asInt(row.count),
    }));

  const expiredCounts: TExpiredCountRow[] = [];
  for (const row of expiredRows) {
    if (!isExpiredPaymentEvent({ type: row.type, status: row.status })) continue;
    expiredCounts.push({
      provider: row.provider,
      currency: row.currency,
      count: asInt(row.count),
    });
  }

  const timeToPay: TTimeToPayRow[] = timeToPayRows.map((row) => ({
    provider: row.provider,
    currency: row.currency,
    avgSeconds: asNullableNumber(row.avgSeconds),
    p50Seconds: asNullableNumber(row.p50Seconds),
    p95Seconds: asNullableNumber(row.p95Seconds),
  }));

  const webhookCurrent: TWebhookCountRow[] = [];
  const webhookPrevious: TWebhookCountRow[] = [];
  for (const row of webhookRows) {
    const base = {
      provider: row.provider,
      type: row.type,
      status: row.status,
      matched: Boolean(row.matched),
      signatureValid: Boolean(row.signatureValid),
    };
    if (asInt(row.current) > 0) webhookCurrent.push({ ...base, count: asInt(row.current) });
    if (asInt(row.previous) > 0) webhookPrevious.push({ ...base, count: asInt(row.previous) });
  }

  const byVariance: TFincraVarianceRow[] = fincraRows.map((row) => {
    const expected = toMajor(row.expectedMinor);
    const received = toMajor(row.receivedMinor);
    const fee = toMajor(row.feeMinor);
    return {
      varianceType: row.varianceType,
      count: asInt(row.count),
      expectedMinor: expected.minor,
      receivedMinor: received.minor,
      feeMinor: fee.minor,
      expectedMajor: expected.major,
      receivedMajor: received.major,
      feeMajor: fee.major,
    };
  });

  const refundPending = refundCountRows.find((row) => row.paymentStatus === "refund_pending");
  const refunded = refundCountRows.find((row) => row.paymentStatus === "refunded");
  const pendingValue = refundValueRows
    .filter((row) => row.paymentStatus === "refund_pending")
    .map((row) => toMoney(row.currency, row.amountMinor));
  const refundedValue = refundValueRows
    .filter((row) => row.paymentStatus === "refunded")
    .map((row) => toMoney(row.currency, row.amountMinor));

  const ocrByStatus = (status: string) => {
    const row = ocrStatusRows.find((r) => r.status === status);
    return { current: asInt(row?.current), previous: asInt(row?.previous) };
  };
  const ocrSucceeded = ocrByStatus("succeeded");
  const ocrFailed = ocrByStatus("failed");
  const ocrAttemptsCurrent = ocrStatusRows.reduce((sum, row) => sum + asInt(row.current), 0);
  const ocrAttemptsPrevious = ocrStatusRows.reduce((sum, row) => sum + asInt(row.previous), 0);

  const errorCodes: TOcrErrorCodeRow[] = ocrErrorRows.map((row) => ({
    code: row.code,
    count: asInt(row.count),
  }));

  const tokensByModel: TOcrTokenModelRow[] = ocrTokenRows.map((row) => {
    const promptTokens = asInt(row.promptTokens);
    const outputTokens = asInt(row.outputTokens);
    const totalTokens = asInt(row.totalTokens) || promptTokens + outputTokens;
    return {
      model: row.model,
      attempts: asInt(row.attempts),
      promptTokens,
      outputTokens,
      totalTokens,
    };
  });

  const emailsByKind: TEmailKindRow[] = emailRows.map((row) => ({
    kind: row.kind,
    count: asInt(row.count),
  }));

  const manual = {
    withProvenance: asInt(manualEditRows[0]?.withProvenance),
    withManualField: asInt(manualEditRows[0]?.withManualField),
  };

  const refundAudit = countByPeriod(refundAuditRows);
  const stuck = countByPeriod(stuckRows);
  const cancel = countByPeriod(cancelRows);
  const flagged = countByPeriod(attentionRangeRows);

  return {
    ...empty,
    paymentsByProvider: buildPaymentsByProvider({ statusCounts, expiredCounts, timeToPay }),
    webhooks: summarizeWebhookHealth(webhookCurrent, webhookPrevious),
    fincraMoney: { byVariance },
    refunds: {
      pending: kpi(asInt(refundPending?.current), asInt(refundPending?.previous)),
      refunded: kpi(asInt(refunded?.current), asInt(refunded?.previous)),
      pendingValue,
      refundedValue,
      initiatedAudits: kpi(refundAudit.current, refundAudit.previous),
    },
    stuckCheckouts: {
      count: kpi(stuck.current, stuck.previous),
      thresholdMinutes: STUCK_CHECKOUT_THRESHOLD_MS / 60000,
    },
    cancelReset: {
      auditedAbandons: kpi(cancel.current, cancel.previous),
      customerCancelNotAudited: true,
    },
    ocr: {
      attempts: kpi(ocrAttemptsCurrent, ocrAttemptsPrevious),
      succeeded: kpi(ocrSucceeded.current, ocrSucceeded.previous),
      failed: kpi(ocrFailed.current, ocrFailed.previous),
      successRatePct: kpi(
        conversionPct(ocrSucceeded.current, ocrAttemptsCurrent),
        conversionPct(ocrSucceeded.previous, ocrAttemptsPrevious),
      ),
      errorCodes,
      latencyMs: {
        p50: asNullableNumber(ocrLatencyRows[0]?.p50),
        p95: asNullableNumber(ocrLatencyRows[0]?.p95),
      },
      retryAttempts: asInt(ocrRetryRows[0]?.retryAttempts),
      documentsRetried: asInt(ocrRetryRows[0]?.documentsRetried),
      tokensByModel,
      manualEdits: {
        applicationsWithProvenance: manual.withProvenance,
        applicationsWithManualField: manual.withManualField,
        ratePct: manualEditRatePct(manual),
      },
    },
    conversionSplits: {
      byService: splitRows(serviceSplitRows),
      byCatalogCurrency: splitRows(currencySplitRows),
      byGuest: splitRows(guestSplitRows),
      byTravelerKind: splitRows(travelerSplitRows),
    },
    emailsByKind,
    attentionQueue: {
      size: asInt(attentionLiveRows[0]?.size),
      flaggedInRange: kpi(flagged.current, flagged.previous),
      oldestAgeHours: asNullableNumber(attentionLiveRows[0]?.oldestAgeHours),
      medianAgeHours: asNullableNumber(attentionLiveRows[0]?.medianAgeHours),
    },
  };
};
