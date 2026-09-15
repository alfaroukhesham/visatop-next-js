import { describe, expect, it } from "vitest";
import { analyticsSummaryToCsv, funnelEventsToCsv } from "@/lib/analytics/admin-analytics-csv";
import type { TAdminAnalyticsPayload } from "@/lib/analytics/admin-analytics-types";

const sample: TAdminAnalyticsPayload = {
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
  weekly: [{ weekStart: "2026-09-14", created: 10, paid: 2 }],
  nationalities: [{ code: "IN", name: "India", created: 7, paid: 1 }],
};

describe("analyticsSummaryToCsv", () => {
  it("includes KPI, funnel, and nationality sections", () => {
    const csv = analyticsSummaryToCsv(sample);
    expect(csv).toContain("applications_created,10");
    expect(csv).toContain("application_started,Nationality / start,10");
    expect(csv).toContain("IN,India,7,1");
    expect(csv).not.toContain("@");
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
          source: "client",
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
        source: "client",
      },
    ]);
    expect(csv).toContain("event_name");
    expect(csv.toLowerCase()).not.toContain("email");
    expect(csv.toLowerCase()).not.toContain("passport");
  });
});
