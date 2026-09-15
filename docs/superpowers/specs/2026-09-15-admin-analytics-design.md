# Admin analytics (funnel + pulse)

**Date:** 2026-09-15  
**Status:** approved in conversation; implement immediately

## Goal

Signed-in admins get `/admin/analytics`: pulse KPIs, labeled churn, full apply funnel, week-over-week volume, nationalities, revenue, CSV export.

## Approach

First-party `analytics_funnel_event` plus SQL over `application` / `payment`. GA4/Meta stay as-is. Client beacons view steps; server writes on authoritative mutations (create, email, docs, checkout, paid).

## Identity

- Cookie `vt_sid` (session id) on the customer origin.
- Events: `sessionId` always; `applicationId` when known.
- Unique subject = `applicationId ?? sessionId`.
- No PII in the event table.

## Metrics

- Range: client sends `from`/`to` ISO instants (browser TZ for Today/MTD/YTD/7d). Default last 7 days. Previous period = same duration before `from`. Queries in UTC.
- Funnel: unique subjects per ordered step in range. Biggest drop-off ignores optional branches (`ocr_review_required`, guest-link, `apply_step_view`).
- Churn (three labeled cards): overall abandon `1 − paid/created`; biggest drop-off; abandoned = created in range still unpaid.
- Revenue: paid `payment.amount` in range, **per currency**, never mixed.
- Last paid: latest paid payment (global).
- Export: summary CSV and events CSV (no PII).

## Surfaces

- Admin only: nav + home card. Any signed-in admin (`runAdminDbJson` with no extra permission).
- `GET /api/admin/analytics`, `GET /api/admin/analytics/export`, `POST /api/analytics/events`.
- Layout: pulse first (KPIs → churn → funnel → weekly + nationalities).
