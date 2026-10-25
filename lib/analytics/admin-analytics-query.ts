import { and, desc, eq, gte, inArray, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  analyticsFunnelEvent,
  application,
  applicationParty,
  nationality,
  payment,
  paymentEvent,
  user,
  visaService,
} from "@/lib/db/schema";
import {
  mergePaymentFailureBreakdown,
  toConversionDimensionRows,
} from "@/lib/analytics/admin-analytics-conversion";
import { toDurationPercentiles } from "@/lib/analytics/admin-analytics-durations";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { abandonStopFromCursor, type TApplyWizardScreen } from "@/lib/apply/apply-wizard";
import {
  deltaPct,
  previousPeriod,
  utcMondayWeekStartIso,
  type TInstantRange,
} from "@/lib/analytics/analytics-range";
import {
  extraStepCounts,
  buildFunnelRows,
  computeChurnTrio,
} from "@/lib/analytics/funnel-metrics";
import {
  ADMIN_FUNNEL_STEP_EVENT_NAMES,
  applicantEmail,
  applicantPaidAmountMinor,
  applicantPaidCurrency,
  indexApplicantPayments,
  toApplicantExportRow,
} from "@/lib/analytics/admin-analytics-applicants";
import type {
  TAdminAnalyticsPayload,
  TAnalyticsKpi,
  TApplicantExportRow,
  TFunnelEventExportRow,
} from "@/lib/analytics/admin-analytics-types";
import { loadAdminAnalyticsExpansion } from "@/lib/analytics/admin-analytics-expansion-query";
import { minorUnitsToJsonSafeNumber } from "@/lib/pricing/minor-units-json";

export const ANALYTICS_EVENTS_EXPORT_LIMIT = 20000;

const kpi = (current: number, previous: number): TAnalyticsKpi => ({
  current,
  previous,
  deltaPct: deltaPct(current, previous),
});

const asInt = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const inRange = (column: Parameters<typeof gte>[0], range: TInstantRange) =>
  and(gte(column, range.from), lt(column, range.to));

const conversionPct = (paid: number, created: number): number => {
  if (created <= 0) return 0;
  return (paid / created) * 100;
};

const utcWeekStart = (column: Parameters<typeof gte>[0]) =>
  sql`date_trunc('week', ${column} at time zone 'UTC')`;

const paidViaCheckoutInRange = (range: TInstantRange) => sql`
  ${application.paymentStatus} = 'paid'
  and (
    (${application.updatedAt} >= ${range.from} and ${application.updatedAt} < ${range.to})
    or exists (
      select 1
      from payment p
      inner join application payer on payer.id = p.application_id
      where p.status = 'paid'
        and p.updated_at >= ${range.from}
        and p.updated_at < ${range.to}
        and (
          payer.id = ${application.id}
          or (${application.partyId} is not null and payer.party_id = ${application.partyId})
        )
    )
  )
`;

const paidKpiIdsInRange = (range: TInstantRange) => sql`
  select ${application.id} as paid_id
  from ${application}
  where ${paidViaCheckoutInRange(range)}
  union
  select e.application_id
  from analytics_funnel_event e
  where e.event_name = ${APPLY_FUNNEL_EVENTS.paymentSucceeded}
    and e.application_id is not null
    and e.occurred_at >= ${range.from}
    and e.occurred_at < ${range.to}
`;

const paidKpiCountInRange = (range: TInstantRange) =>
  sql<number>`cast((select count(*) from (${paidKpiIdsInRange(range)}) paid_ids) as int)`;

const APPLY_STOP_SCREENS = ["ready", "passport", "other", "details", "pay"] as const;

const APPLY_STOP_LABELS: Record<(typeof APPLY_STOP_SCREENS)[number], string> = {
  ready: "What you'll need",
  passport: "Passport",
  other: "Other documents",
  details: "Check your details",
  pay: "Payment",
};

const mergeWeekly = (
  createdRows: { weekStart: string; n: number }[],
  paidRows: { weekStart: string; n: number }[],
): { weekStart: string; created: number; paid: number }[] => {
  const weekMap = new Map<string, { created: number; paid: number }>();
  for (const row of createdRows) {
    const key = row.weekStart;
    const cur = weekMap.get(key) ?? { created: 0, paid: 0 };
    cur.created += asInt(row.n);
    weekMap.set(key, cur);
  }
  for (const row of paidRows) {
    const key = row.weekStart;
    const cur = weekMap.get(key) ?? { created: 0, paid: 0 };
    cur.paid += asInt(row.n);
    weekMap.set(key, cur);
  }
  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, v]) => ({ weekStart, ...v }));
};

export const loadAdminAnalytics = async (
  tx: DbTransaction,
  range: TInstantRange,
): Promise<TAdminAnalyticsPayload> => {
  const prev = previousPeriod(range);

  const [appAgg, lastPaidRows, revenueRows, createdWeeks, paidWeeks, events, nationalityRows, stopRows, failureRows, expansion] =
    await Promise.all([
      tx
        .select({
          created: sql<number>`cast(count(*) filter (where ${application.createdAt} >= ${range.from} and ${application.createdAt} < ${range.to}) as int)`,
          createdPrev: sql<number>`cast(count(*) filter (where ${application.createdAt} >= ${prev.from} and ${application.createdAt} < ${prev.to}) as int)`,
          abandoned: sql<number>`cast(count(*) filter (where ${application.paymentStatus} <> 'paid' and ${application.createdAt} >= ${range.from} and ${application.createdAt} < ${range.to}) as int)`,
          paid: paidKpiCountInRange(range),
          paidPrev: paidKpiCountInRange(prev),
        })
        .from(application),
      tx
        .select({
          lastPaidAt: sql<Date | null>`(
            select max(ts) from (
              select max(${payment.updatedAt}) as ts from ${payment} where ${payment.status} = 'paid'
              union all
              select max(${application.updatedAt}) from ${application} where ${application.paymentStatus} = 'paid'
              union all
              select max(${analyticsFunnelEvent.occurredAt})
              from ${analyticsFunnelEvent}
              where ${analyticsFunnelEvent.eventName} = ${APPLY_FUNNEL_EVENTS.paymentSucceeded}
            ) last_paid
          )`,
        })
        .from(sql`(select 1) as last_paid_kpi`),
      tx
        .select({
          currency: payment.currency,
          amount: sql<string>`cast(sum(${payment.amount}) as text)`,
        })
        .from(payment)
        .where(and(eq(payment.status, "paid"), inRange(payment.updatedAt, range)))
        .groupBy(payment.currency),
      tx
        .select({
          weekStart: sql<string>`to_char(${utcWeekStart(application.createdAt)}, 'YYYY-MM-DD')`,
          n: sql<number>`cast(count(*) as int)`,
        })
        .from(application)
        .where(inRange(application.createdAt, range))
        .groupBy(utcWeekStart(application.createdAt)),
      tx
        .select({
          weekStart: sql<string>`week_start`,
          n: sql<number>`cast(count(distinct paid_id) as int)`,
        })
        .from(
          sql`(
            select to_char(date_trunc('week', p.updated_at at time zone 'UTC'), 'YYYY-MM-DD') as week_start,
                   a.id as paid_id
            from application a
            inner join payment p on p.status = 'paid'
              and p.updated_at >= ${range.from}
              and p.updated_at < ${range.to}
            inner join application payer on payer.id = p.application_id
            where a.payment_status = 'paid'
              and (
                a.id = p.application_id
                or (a.party_id is not null and a.party_id = payer.party_id)
              )
            union
            select to_char(date_trunc('week', a.updated_at at time zone 'UTC'), 'YYYY-MM-DD'),
                   a.id
            from application a
            where a.payment_status = 'paid'
              and a.updated_at >= ${range.from}
              and a.updated_at < ${range.to}
            union
            select to_char(date_trunc('week', e.occurred_at at time zone 'UTC'), 'YYYY-MM-DD'),
                   e.application_id
            from analytics_funnel_event e
            where e.event_name = ${APPLY_FUNNEL_EVENTS.paymentSucceeded}
              and e.application_id is not null
              and e.occurred_at >= ${range.from}
              and e.occurred_at < ${range.to}
          ) paid_weeks`,
        )
        .groupBy(sql`week_start`),
      tx
        .select({
          eventName: analyticsFunnelEvent.eventName,
          sessionId: analyticsFunnelEvent.sessionId,
          applicationId: analyticsFunnelEvent.applicationId,
        })
        .from(analyticsFunnelEvent)
        .where(inRange(analyticsFunnelEvent.occurredAt, range)),
      tx
        .select({
          code: application.nationalityCode,
          name: nationality.name,
          created: sql<number>`cast(count(*) as int)`,
          paid: sql<number>`cast(count(*) filter (where ${application.paymentStatus} = 'paid') as int)`,
        })
        .from(application)
        .innerJoin(nationality, eq(nationality.code, application.nationalityCode))
        .where(inRange(application.createdAt, range))
        .groupBy(application.nationalityCode, nationality.name)
        .orderBy(sql`count(*) desc`)
        .limit(10),
      tx
        .select({
          screen: applicationParty.wizardCursorScreen,
          travellerId: applicationParty.wizardCursorTravellerId,
          lastId: sql<string | null>`(
            select a2.id from application a2
            where a2.party_id = ${application.partyId}
            order by a2.traveler_index desc
            limit 1
          )`,
        })
        .from(application)
        .leftJoin(applicationParty, eq(applicationParty.id, application.partyId))
        .where(
          and(
            sql`${application.paymentStatus} <> 'paid'`,
            inRange(application.createdAt, range),
            or(eq(application.travelerRole, "primary"), sql`${application.partyId} is null`),
          ),
        ),
      tx
        .select({
          code: analyticsFunnelEvent.failureReason,
          count: sql<number>`cast(count(distinct coalesce(${analyticsFunnelEvent.applicationId}, ${analyticsFunnelEvent.sessionId})) as int)`,
        })
        .from(analyticsFunnelEvent)
        .where(
          and(
            eq(analyticsFunnelEvent.eventName, APPLY_FUNNEL_EVENTS.passportUploadFailed),
            inRange(analyticsFunnelEvent.occurredAt, range),
          ),
        )
        .groupBy(analyticsFunnelEvent.failureReason),
      loadAdminAnalyticsExpansion(tx, range),
    ]);

  const created = asInt(appAgg[0]?.created);
  const createdPrev = asInt(appAgg[0]?.createdPrev);
  const abandonedDrafts = asInt(appAgg[0]?.abandoned);
  const paid = asInt(appAgg[0]?.paid);
  const paidPrev = asInt(appAgg[0]?.paidPrev);
  const lastPaidAtRaw = lastPaidRows[0]?.lastPaidAt ?? null;
  const lastPaidAt =
    lastPaidAtRaw instanceof Date
      ? lastPaidAtRaw.toISOString()
      : lastPaidAtRaw
        ? new Date(lastPaidAtRaw).toISOString()
        : null;

  const isWizardScreen = (value: string | null): value is TApplyWizardScreen =>
    value === "ready" || value === "passport" || value === "other" || value === "details";
  const stopCounts = new Map<string, number>();
  for (const row of stopRows) {
    const stop = abandonStopFromCursor({
      cursor: isWizardScreen(row.screen)
        ? { screen: row.screen, travellerId: row.travellerId }
        : null,
      lastTravellerId: row.lastId,
    });
    stopCounts.set(stop, (stopCounts.get(stop) ?? 0) + 1);
  }

  const funnel = buildFunnelRows(events);
  const extraSteps = extraStepCounts(events);
  const churn = computeChurnTrio({
    created,
    paid,
    abandonedDrafts,
    funnel,
  });

  const weekly = mergeWeekly(
    createdWeeks.map((r) => ({ weekStart: r.weekStart, n: asInt(r.n) })),
    paidWeeks.map((r) => ({ weekStart: r.weekStart, n: asInt(r.n) })),
  );

  const revenue = revenueRows.map((row) => {
    const minor = BigInt(row.amount ?? "0");
    return {
      currency: row.currency,
      amountMinor: minor.toString(),
      amountMajor: minorUnitsToJsonSafeNumber(minor) / 100,
    };
  });

  const [
    timeToPayRows,
    paidToFulfilledRows,
    fincraFailureRows,
    otherFailureRows,
    countryConversionRows,
    deviceConversionRows,
  ] = await Promise.all([
    tx
      .select({
        p50: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${application.paidAt} - ${application.createdAt})))`,
        p95: sql<number | null>`percentile_cont(0.95) within group (order by extract(epoch from (${application.paidAt} - ${application.createdAt})))`,
        n: sql<number>`cast(count(*) as int)`,
      })
      .from(application)
      .where(
        and(
          isNotNull(application.paidAt),
          inRange(application.paidAt, range),
          sql`${application.paidAt} >= ${application.createdAt}`,
        ),
      ),
    tx
      .select({
        p50: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${application.fulfilledAt} - ${application.paidAt})))`,
        p95: sql<number | null>`percentile_cont(0.95) within group (order by extract(epoch from (${application.fulfilledAt} - ${application.paidAt})))`,
        n: sql<number>`cast(count(*) as int)`,
      })
      .from(application)
      .where(
        and(
          isNotNull(application.fulfilledAt),
          isNotNull(application.paidAt),
          inRange(application.fulfilledAt, range),
          sql`${application.fulfilledAt} >= ${application.paidAt}`,
        ),
      ),
    tx
      .select({
        type: paymentEvent.type,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(paymentEvent)
      .where(
        and(
          inArray(paymentEvent.type, ["charge.failed", "charge.expired"]),
          inRange(paymentEvent.receivedAt, range),
        ),
      )
      .groupBy(paymentEvent.type),
    tx
      .select({
        provider: payment.provider,
        code: payment.failureCode,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(payment)
      .where(
        and(
          isNotNull(payment.failureCode),
          ne(payment.provider, "fincra"),
          ne(payment.status, "paid"),
          inRange(payment.updatedAt, range),
        ),
      )
      .groupBy(payment.provider, payment.failureCode),
    tx
      .select({
        key: sql<string>`coalesce(nullif(${analyticsFunnelEvent.countryCode}, ''), ${analyticsFunnelEvent.nationalityCode}, 'unknown')`,
        created: sql<number>`cast(count(distinct coalesce(${analyticsFunnelEvent.applicationId}, ${analyticsFunnelEvent.sessionId})) as int)`,
        paid: sql<number>`cast(count(distinct coalesce(${analyticsFunnelEvent.applicationId}, ${analyticsFunnelEvent.sessionId})) filter (where ${analyticsFunnelEvent.eventName} = ${APPLY_FUNNEL_EVENTS.paymentSucceeded}) as int)`,
      })
      .from(analyticsFunnelEvent)
      .where(inRange(analyticsFunnelEvent.occurredAt, range))
      .groupBy(
        sql`coalesce(nullif(${analyticsFunnelEvent.countryCode}, ''), ${analyticsFunnelEvent.nationalityCode}, 'unknown')`,
      )
      .orderBy(
        sql`count(distinct coalesce(${analyticsFunnelEvent.applicationId}, ${analyticsFunnelEvent.sessionId})) desc`,
      )
      .limit(15),
    tx
      .select({
        key: sql<string>`coalesce(${analyticsFunnelEvent.deviceType}, 'unknown')`,
        created: sql<number>`cast(count(distinct coalesce(${analyticsFunnelEvent.applicationId}, ${analyticsFunnelEvent.sessionId})) as int)`,
        paid: sql<number>`cast(count(distinct coalesce(${analyticsFunnelEvent.applicationId}, ${analyticsFunnelEvent.sessionId})) filter (where ${analyticsFunnelEvent.eventName} = ${APPLY_FUNNEL_EVENTS.paymentSucceeded}) as int)`,
      })
      .from(analyticsFunnelEvent)
      .where(inRange(analyticsFunnelEvent.occurredAt, range))
      .groupBy(sql`coalesce(${analyticsFunnelEvent.deviceType}, 'unknown')`)
      .orderBy(
        sql`count(distinct coalesce(${analyticsFunnelEvent.applicationId}, ${analyticsFunnelEvent.sessionId})) desc`,
      )
      .limit(15),
  ]);

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    kpis: {
      applicationsCreated: kpi(created, createdPrev),
      paid: kpi(paid, paidPrev),
      conversionPct: kpi(conversionPct(paid, created), conversionPct(paidPrev, createdPrev)),
      lastPaidAt,
    },
    revenue,
    churn,
    funnel,
    extraSteps,
    stops: APPLY_STOP_SCREENS.map((screen) => ({
      screen,
      label: APPLY_STOP_LABELS[screen],
      count: stopCounts.get(screen) ?? 0,
    })),
    passportFailures: failureRows.map((row) => ({
      code: row.code ?? "unspecified",
      count: asInt(row.count),
    })),
    weekly,
    nationalities: nationalityRows.map((r) => ({
      code: r.code,
      name: r.name,
      created: asInt(r.created),
      paid: asInt(r.paid),
    })),
    ...expansion,
    durations: {
      timeToPay: toDurationPercentiles(timeToPayRows[0] ?? { n: 0 }),
      paidToFulfilled: toDurationPercentiles(paidToFulfilledRows[0] ?? { n: 0 }),
    },
    paymentFailures: mergePaymentFailureBreakdown(fincraFailureRows, otherFailureRows),
    conversionByCountry: toConversionDimensionRows(countryConversionRows).map((row) => ({
      key: row.key,
      created: row.created,
      paid: row.paid,
    })),
    conversionByDevice: toConversionDimensionRows(deviceConversionRows).map((row) => ({
      key: row.key,
      created: row.created,
      paid: row.paid,
    })),
  };
};

export type TFunnelEventsExport = {
  rows: TFunnelEventExportRow[];
  truncated: boolean;
};

export const loadFunnelEventsForExport = async (
  tx: DbTransaction,
  range: TInstantRange,
): Promise<TFunnelEventsExport> => {
  const rows = await tx
    .select({
      occurredAt: analyticsFunnelEvent.occurredAt,
      eventName: analyticsFunnelEvent.eventName,
      sessionId: analyticsFunnelEvent.sessionId,
      applicationId: analyticsFunnelEvent.applicationId,
      nationalityCode: analyticsFunnelEvent.nationalityCode,
      serviceId: analyticsFunnelEvent.serviceId,
      countryCode: analyticsFunnelEvent.countryCode,
      deviceType: analyticsFunnelEvent.deviceType,
      source: analyticsFunnelEvent.source,
      failureReason: analyticsFunnelEvent.failureReason,
    })
    .from(analyticsFunnelEvent)
    .where(inRange(analyticsFunnelEvent.occurredAt, range))
    .orderBy(analyticsFunnelEvent.occurredAt)
    .limit(ANALYTICS_EVENTS_EXPORT_LIMIT + 1);
  const truncated = rows.length > ANALYTICS_EVENTS_EXPORT_LIMIT;
  const sliced = truncated ? rows.slice(0, ANALYTICS_EVENTS_EXPORT_LIMIT) : rows;
  return {
    truncated,
    rows: sliced.map((r) => ({
      occurredAt: r.occurredAt.toISOString(),
      eventName: r.eventName,
      sessionId: r.sessionId,
      applicationId: r.applicationId,
      nationalityCode: r.nationalityCode,
      serviceId: r.serviceId,
      countryCode: r.countryCode,
      deviceType: r.deviceType,
      source: r.source,
      failureReason: r.failureReason,
    })),
  };
};

export type TApplicantsExport = {
  rows: TApplicantExportRow[];
  truncated: boolean;
};

export const loadApplicantsForExport = async (
  tx: DbTransaction,
  range: TInstantRange,
): Promise<TApplicantsExport> => {
  const apps = await tx
    .select({
      id: application.id,
      createdAt: application.createdAt,
      paymentStatus: application.paymentStatus,
      catalogCurrency: application.catalogCurrency,
      guestEmail: application.guestEmail,
      userEmail: user.email,
      partyGuestEmail: applicationParty.guestEmail,
      partyId: application.partyId,
      visaType: visaService.name,
    })
    .from(application)
    .leftJoin(user, eq(user.id, application.userId))
    .leftJoin(applicationParty, eq(applicationParty.id, application.partyId))
    .innerJoin(visaService, eq(visaService.id, application.serviceId))
    .where(inRange(application.createdAt, range))
    .orderBy(desc(application.createdAt))
    .limit(ANALYTICS_EVENTS_EXPORT_LIMIT + 1);

  const truncated = apps.length > ANALYTICS_EVENTS_EXPORT_LIMIT;
  const sliced = truncated ? apps.slice(0, ANALYTICS_EVENTS_EXPORT_LIMIT) : apps;
  if (sliced.length === 0) {
    return { rows: [], truncated: false };
  }

  const ids = sliced.map((app) => app.id);
  const partyIds = [
    ...new Set(sliced.map((app) => app.partyId).filter((id): id is string => Boolean(id))),
  ];
  const paymentScope =
    partyIds.length > 0
      ? or(inArray(payment.applicationId, ids), inArray(application.partyId, partyIds))
      : inArray(payment.applicationId, ids);

  const paidPayments = await tx
    .select({
      applicationId: payment.applicationId,
      partyId: application.partyId,
      amount: payment.amount,
      currency: payment.currency,
    })
    .from(payment)
    .innerJoin(application, eq(application.id, payment.applicationId))
    .where(and(eq(payment.status, "paid"), paymentScope));

  const events = await tx
    .select({
      applicationId: analyticsFunnelEvent.applicationId,
      eventName: analyticsFunnelEvent.eventName,
    })
    .from(analyticsFunnelEvent)
    .where(
      and(
        inArray(analyticsFunnelEvent.applicationId, ids),
        isNotNull(analyticsFunnelEvent.applicationId),
        inArray(analyticsFunnelEvent.eventName, [...ADMIN_FUNNEL_STEP_EVENT_NAMES]),
      ),
    );

  const eventNamesByApp = new Map<string, string[]>();
  for (const event of events) {
    if (!event.applicationId) continue;
    const list = eventNamesByApp.get(event.applicationId) ?? [];
    list.push(event.eventName);
    eventNamesByApp.set(event.applicationId, list);
  }

  const paymentRows = paidPayments.map((row) => ({
    applicationId: row.applicationId,
    partyId: row.partyId,
    amountMinor: typeof row.amount === "bigint" ? row.amount : BigInt(row.amount ?? 0),
    currency: row.currency,
  }));
  const indexed = indexApplicantPayments(paymentRows);

  const rows = sliced.map((app) => {
    const isPaid = app.paymentStatus === "paid";
    return toApplicantExportRow({
      email: applicantEmail({
        guestEmail: app.guestEmail,
        userEmail: app.userEmail,
        partyGuestEmail: app.partyGuestEmail,
      }),
      createdAt: app.createdAt,
      isPaid,
      amountMinor: applicantPaidAmountMinor({
        isPaid,
        applicationId: app.id,
        partyId: app.partyId,
        indexed,
      }),
      currency: applicantPaidCurrency({
        isPaid,
        catalogCurrency: app.catalogCurrency,
        applicationId: app.id,
        partyId: app.partyId,
        indexed,
      }),
      visaType: app.visaType,
      eventNames: eventNamesByApp.get(app.id) ?? [],
    });
  });

  return { rows, truncated };
};

/** Exported for tests — Postgres `date_trunc('week')` is Monday. */
export const utcWeekKeyFromTrunc = utcMondayWeekStartIso;
