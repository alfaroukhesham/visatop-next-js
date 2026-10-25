import { describe, expect, it } from "vitest";
import { analyticsSummaryToCsv, funnelEventsToCsv } from "@/lib/analytics/admin-analytics-csv";
import { emptyAdminAnalyticsExpansion } from "@/lib/analytics/admin-analytics-expansion";
import type { TAdminAnalyticsPayload } from "@/lib/analytics/admin-analytics-types";

const sample: TAdminAnalyticsPayload = {
  ...emptyAdminAnalyticsExpansion(),
  range: { from: "2026-09-08T00:00:00.000Z", to: "2026-09-15T00:00:00.000Z" },
  kpis: {
    applicationsCreated: { current: 10, previous: 8, deltaPct: 25 },
    paid: { current: 2, previous: 1, deltaPct: 100 },
    conversionPct: { current: 20, previous: 12.5, deltaPct: 60 },
    lastPaidAt: "2026-09-14T10:00:00.000Z",
  },
  revenue: [{ currency: "USD", amountMinor: "19900", amountMajor: 199 }],
  churn: {
    overallAbandonPct: 80,
    biggestDrop: {
      eventName: "checkout_viewed",
      label: "Checkout viewed",
      fromCount: 5,
      toCount: 2,
      dropPct: 60,
    },
    abandonedDrafts: 6,
  },
  funnel: [
    {
      eventName: "application_started",
      label: "Nationality / start",
      count: 10,
      keepPct: null,
      dropPct: null,
    },
  ],
  extraSteps: [],
  stops: [],
  passportFailures: [],
  weekly: [{ weekStart: "2026-09-14", created: 10, paid: 2 }],
  nationalities: [{ code: "IN", name: "India", created: 7, paid: 1 }],
  paymentsByProvider: [
    {
      provider: "fincra",
      currency: "NGN",
      attempts: 8,
      paid: 2,
      failed: 1,
      expired: 2,
      mismatch: 1,
      conversionPct: 25,
      timeToPaySeconds: { avg: 90, p50: 60, p95: 180 },
    },
  ],
  emailsByKind: [{ kind: "application_draft_started", count: 4 }],
  durations: {
    timeToPay: { p50Seconds: 120, p95Seconds: 3600, sampleSize: 2 },
    paidToFulfilled: { p50Seconds: 86400, p95Seconds: 172800, sampleSize: 1 },
  },
  paymentFailures: [{ code: "fincra:expired", count: 3 }],
  conversionByCountry: [{ key: "IN", created: 7, paid: 1 }],
  conversionByDevice: [{ key: "mobile", created: 6, paid: 1 }],
};

describe("analyticsSummaryToCsv", () => {
  it("includes KPI, funnel, and nationality sections", () => {
    const csv = analyticsSummaryToCsv(sample);
    expect(csv).toContain("applications_created,10");
    expect(csv).toContain("application_started,Nationality / start,10");
    expect(csv).toContain("IN,India,7,1");
    expect(csv).toContain("time_to_pay,120,3600,2");
    expect(csv).toContain("fincra:expired,3");
    expect(csv).toContain("mobile,6,1");
    expect(csv).not.toContain("@");
  });

  it("includes observability sections without emails, names, or passport fields", () => {
    const csv = analyticsSummaryToCsv(sample);
    expect(csv).toContain("fincra,NGN,8,2,1,2,1,25,90,60,180");
    expect(csv).toContain("application_draft_started,4");
    expect(csv).toContain("webhook_kpi");
    expect(csv).toContain("ocr_attempts");
    expect(csv).not.toMatch(/@[a-z0-9]/i);
    expect(csv).not.toContain("passport_number");
    expect(csv).not.toContain("full_name");
    expect(csv).not.toContain("guest_email");
  });
});

describe("funnelEventsToCsv", () => {
  it("marks the file truncated when the export cap is hit", () => {
    const csv = funnelEventsToCsv(
      [
        {
          occurredAt: "2026-09-14T00:00:00.000Z",
          eventName: "visa_list_viewed",
          sessionId: "s1",
          applicationId: null,
          nationalityCode: "IN",
          serviceId: null,
          countryCode: "IN",
          deviceType: "mobile",
          source: "client",
          failureReason: null,
        },
      ],
      { truncated: true, maxRows: 20000 },
    );
    expect(csv).toContain("truncated,true");
    expect(csv).toContain("20000");
  });

  it("does not emit email or name columns", () => {
    const csv = funnelEventsToCsv([
      {
        occurredAt: "2026-09-14T00:00:00.000Z",
        eventName: "visa_list_viewed",
        sessionId: "s1",
        applicationId: null,
        nationalityCode: "IN",
        serviceId: null,
        countryCode: "IN",
        deviceType: "desktop",
        source: "client",
        failureReason: null,
      },
    ]);
    expect(csv).toContain("event_name");
    expect(csv).toContain("country_code");
    expect(csv).toContain("device_type");
    expect(csv.toLowerCase()).not.toContain("email");
    expect(csv.toLowerCase()).not.toContain("passport");
  });
});
