export type TAnalyticsKpi = {
  current: number;
  previous: number;
  deltaPct: number | null;
};

export type TFunnelRow = {
  eventName: string;
  label: string;
  count: number;
  keepPct: number | null;
  dropPct: number | null;
};

export type TBiggestDrop = {
  eventName: string;
  label: string;
  fromCount: number;
  toCount: number;
  dropPct: number;
};

export type TAdminAnalyticsPayload = {
  range: { from: string; to: string };
  kpis: {
    applicationsCreated: TAnalyticsKpi;
    paid: TAnalyticsKpi;
    conversionPct: TAnalyticsKpi;
    lastPaidAt: string | null;
  };
  revenue: { currency: string; amountMinor: string; amountMajor: number }[];
  churn: {
    overallAbandonPct: number | null;
    biggestDrop: TBiggestDrop | null;
    abandonedDrafts: number;
  };
  funnel: TFunnelRow[];
  extraSteps: { eventName: string; label: string; count: number }[];
  weekly: { weekStart: string; created: number; paid: number }[];
  nationalities: { code: string; name: string; created: number; paid: number }[];
};

export type TFunnelEventExportRow = {
  occurredAt: string;
  eventName: string;
  sessionId: string;
  applicationId: string | null;
  nationalityCode: string | null;
  serviceId: string | null;
  source: string;
};

export type TApplicantExportRow = {
  email: string;
  createdAt: string;
  paid: "yes" | "no";
  amountPaid: string;
  visaType: string;
  lastStep: string;
};
