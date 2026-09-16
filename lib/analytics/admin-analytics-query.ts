import { and, desc, eq, gte, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  analyticsFunnelEvent,
  application,
  applicationParty,
  nationality,
  payment,
  user,
  visaService,
} from "@/lib/db/schema";
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
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

  const [appAgg, lastPaidRows, revenueRows, createdWeeks, paidWeeks, events, nationalityRows] =
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
    weekly,
    nationalities: nationalityRows.map((r) => ({
      code: r.code,
      name: r.name,
      created: asInt(r.created),
      paid: asInt(r.paid),
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
      source: analyticsFunnelEvent.source,
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
      source: r.source,
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
