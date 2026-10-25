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
    "",
    "payments_provider,currency,attempts,paid,failed,expired,mismatch,conversion_pct,time_to_pay_avg_s,time_to_pay_p50_s,time_to_pay_p95_s",
    ...payload.paymentsByProvider.map((r) =>
      csvLine([
        r.provider,
        r.currency,
        r.attempts,
        r.paid,
        r.failed,
        r.expired,
        r.mismatch,
        r.conversionPct,
        r.timeToPaySeconds.avg,
        r.timeToPaySeconds.p50,
        r.timeToPaySeconds.p95,
      ]),
    ),
    "",
    "webhook_kpi,current,previous,delta_pct",
    csvLine(["matched", payload.webhooks.matched.current, payload.webhooks.matched.previous, payload.webhooks.matched.deltaPct]),
    csvLine(["unmatched", payload.webhooks.unmatched.current, payload.webhooks.unmatched.previous, payload.webhooks.unmatched.deltaPct]),
    csvLine([
      "bad_signatures",
      payload.webhooks.badSignatures.current,
      payload.webhooks.badSignatures.previous,
      payload.webhooks.badSignatures.deltaPct,
    ]),
    "",
    "webhook_provider,type,status,count",
    ...payload.webhooks.byType.map((r) => csvLine([r.provider, r.type, r.status, r.count])),
    "",
    "fincra_variance,count,expected_minor,received_minor,fee_minor",
    ...payload.fincraMoney.byVariance.map((r) =>
      csvLine([r.varianceType, r.count, r.expectedMinor, r.receivedMinor, r.feeMinor]),
    ),
    "",
    "refunds_pending,refunds_refunded,refunds_initiated_audits",
    csvLine([
      payload.refunds.pending.current,
      payload.refunds.refunded.current,
      payload.refunds.initiatedAudits.current,
    ]),
    "",
    "refund_status,currency,amount_minor,amount_major",
    ...payload.refunds.pendingValue.map((r) => csvLine(["refund_pending", r.currency, r.amountMinor, r.amountMajor])),
    ...payload.refunds.refundedValue.map((r) => csvLine(["refunded", r.currency, r.amountMinor, r.amountMajor])),
    "",
    csvLine(["stuck_checkouts", payload.stuckCheckouts.count.current, payload.stuckCheckouts.thresholdMinutes]),
    csvLine(["cancel_reset_audited_abandons", payload.cancelReset.auditedAbandons.current]),
    "",
    "ocr_attempts,ocr_succeeded,ocr_failed,ocr_success_pct,ocr_p50_ms,ocr_p95_ms,ocr_retry_attempts,ocr_documents_retried,ocr_manual_edit_rate_pct",
    csvLine([
      payload.ocr.attempts.current,
      payload.ocr.succeeded.current,
      payload.ocr.failed.current,
      payload.ocr.successRatePct.current,
      payload.ocr.latencyMs.p50,
      payload.ocr.latencyMs.p95,
      payload.ocr.retryAttempts,
      payload.ocr.documentsRetried,
      payload.ocr.manualEdits.ratePct,
    ]),
    "",
    "ocr_error_code,count",
    ...payload.ocr.errorCodes.map((r) => csvLine([r.code, r.count])),
    "",
    "ocr_model,attempts,prompt_tokens,output_tokens,total_tokens",
    ...payload.ocr.tokensByModel.map((r) =>
      csvLine([r.model, r.attempts, r.promptTokens, r.outputTokens, r.totalTokens]),
    ),
    "",
    "split_kind,key,label,created,paid",
    ...payload.conversionSplits.byService.map((r) => csvLine(["service", r.key, r.label, r.created, r.paid])),
    ...payload.conversionSplits.byCatalogCurrency.map((r) =>
      csvLine(["catalog_currency", r.key, r.label, r.created, r.paid]),
    ),
    ...payload.conversionSplits.byGuest.map((r) => csvLine(["guest", r.key, r.label, r.created, r.paid])),
    ...payload.conversionSplits.byTravelerKind.map((r) =>
      csvLine(["traveler_kind", r.key, r.label, r.created, r.paid]),
    ),
    "",
    "email_kind,count",
    ...payload.emailsByKind.map((r) => csvLine([r.kind, r.count])),
    "",
    csvLine([
      "attention_queue_size",
      payload.attentionQueue.size,
      payload.attentionQueue.oldestAgeHours,
      payload.attentionQueue.medianAgeHours,
    ]),
    csvLine([
      "attention_flagged_in_range",
      payload.attentionQueue.flaggedInRange.current,
      payload.attentionQueue.flaggedInRange.previous,
    ]),
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
