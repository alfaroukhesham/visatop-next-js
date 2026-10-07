import type {
  TAdminAnalyticsPayload,
  TApplicantExportRow,
  TFunnelEventExportRow,
} from "@/lib/analytics/admin-analytics-types";

const csvCell = (value: string | number | null | undefined): string => {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const formulaSafeCsvCell = (value: string | number | null | undefined): string => {
  const s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) return csvCell(`'${s}`);
  return csvCell(s);
};

const csvLine = (cells: Array<string | number | null | undefined>): string =>
  cells.map(csvCell).join(",");

export const analyticsSummaryToCsv = (payload: TAdminAnalyticsPayload): string => {
  const lines: string[] = [
    "section,key,value",
    csvLine(["range", "from", payload.range.from]),
    csvLine(["range", "to", payload.range.to]),
    csvLine(["kpi", "applications_created", payload.kpis.applicationsCreated.current]),
    csvLine(["kpi", "applications_created_previous", payload.kpis.applicationsCreated.previous]),
    csvLine(["kpi", "paid", payload.kpis.paid.current]),
    csvLine(["kpi", "paid_previous", payload.kpis.paid.previous]),
    csvLine(["kpi", "conversion_pct", payload.kpis.conversionPct.current]),
    csvLine(["kpi", "last_paid_at", payload.kpis.lastPaidAt]),
    csvLine(["churn", "overall_abandon_pct", payload.churn.overallAbandonPct]),
    csvLine(["churn", "biggest_drop_event", payload.churn.biggestDrop?.eventName ?? ""]),
    csvLine(["churn", "biggest_drop_pct", payload.churn.biggestDrop?.dropPct ?? ""]),
    csvLine(["churn", "abandoned_drafts", payload.churn.abandonedDrafts]),
    "",
    "revenue_currency,amount_minor,amount_major",
    ...payload.revenue.map((r) => csvLine([r.currency, r.amountMinor, r.amountMajor])),
    "",
    "funnel_event,label,count,keep_pct,drop_pct",
    ...payload.funnel.map((r) => csvLine([r.eventName, r.label, r.count, r.keepPct, r.dropPct])),
    "",
    "extra_event,label,count",
    ...payload.extraSteps.map((r) => csvLine([r.eventName, r.label, r.count])),
    "",
    "stop_screen,label,count",
    ...payload.stops.map((r) => csvLine([r.screen, r.label, r.count])),
    "",
    "passport_failure_code,count",
    ...payload.passportFailures.map((r) => csvLine([r.code, r.count])),
    "",
    "week_start,created,paid",
    ...payload.weekly.map((r) => csvLine([r.weekStart, r.created, r.paid])),
    "",
    "nationality_code,name,created,paid",
    ...payload.nationalities.map((r) => csvLine([r.code, r.name, r.created, r.paid])),
  ];
  return `${lines.join("\n")}\n`;
};

export const funnelEventsToCsv = (
  rows: TFunnelEventExportRow[],
  opts?: { truncated?: boolean; maxRows?: number },
): string => {
  const header = csvLine([
    "occurred_at",
    "event_name",
    "session_id",
    "application_id",
    "nationality_code",
    "service_id",
    "source",
    "failure_reason",
  ]);
  const body = rows.map((r) =>
    csvLine([
      r.occurredAt,
      r.eventName,
      r.sessionId,
      r.applicationId,
      r.nationalityCode,
      r.serviceId,
      r.source,
      r.failureReason,
    ]),
  );
  const truncated = Boolean(opts?.truncated);
  const meta = csvLine([
    "truncated",
    truncated ? "true" : "false",
    "max_rows",
    opts?.maxRows ?? rows.length,
  ]);
  return `${[meta, header, ...body].join("\n")}\n`;
};

export const applicantsToCsv = (
  rows: TApplicantExportRow[],
  opts?: { truncated?: boolean; maxRows?: number },
): string => {
  const truncated = Boolean(opts?.truncated);
  const meta = csvLine([
    "truncated",
    truncated ? "true" : "false",
    "max_rows",
    opts?.maxRows ?? rows.length,
  ]);
  const header = csvLine(["email", "created_at", "paid", "amount_paid", "visa_type", "last_step"]);
  const body = rows.map((r) =>
    [
      formulaSafeCsvCell(r.email),
      csvCell(r.createdAt),
      csvCell(r.paid),
      csvCell(r.amountPaid),
      formulaSafeCsvCell(r.visaType),
      csvCell(r.lastStep),
    ].join(","),
  );
  return `${[meta, header, ...body].join("\n")}\n`;
};
