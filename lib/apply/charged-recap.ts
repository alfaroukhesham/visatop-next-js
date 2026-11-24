export type TSettledRecap = {
  currency: string;
  totalAmountMinor: string;
  visaLines: Array<{ applicationId: string; amountMinor: string }>;
  extraLines: Array<{
    key: "fast_track" | "travel_insurance";
    applicationId: string | null;
    amountMinor: string;
  }>;
};

const isExtraKey = (value: unknown): value is TSettledRecap["extraLines"][number]["key"] =>
  value === "fast_track" || value === "travel_insurance";

export const parseChargeBreakdown = (
  raw: string,
): Pick<TSettledRecap, "visaLines" | "extraLines"> => {
  try {
    const parsed = JSON.parse(raw) as {
      lines?: Array<{ applicationId?: unknown; amountMinor?: unknown }>;
      extras?: Array<{ key?: unknown; applicationId?: unknown; amountMinor?: unknown }>;
    };
    const visaLines = Array.isArray(parsed.lines)
      ? parsed.lines.flatMap((line) => {
          if (typeof line.applicationId !== "string" || typeof line.amountMinor !== "string") return [];
          return [{ applicationId: line.applicationId, amountMinor: line.amountMinor }];
        })
      : [];
    const extraLines = Array.isArray(parsed.extras)
      ? parsed.extras.flatMap((line) => {
          if (!isExtraKey(line.key) || typeof line.amountMinor !== "string") return [];
          const applicationId = typeof line.applicationId === "string" ? line.applicationId : null;
          return [{ key: line.key, applicationId, amountMinor: line.amountMinor }];
        })
      : [];
    return { visaLines, extraLines };
  } catch {
    return { visaLines: [], extraLines: [] };
  }
};

/** Documents uses the live quote only once an extra can change the total. */
export const settledRecapFromPreview = (preview: {
  currency: string;
  totalAmountMinor: string;
  availableExtras: readonly unknown[];
  visaLines: Array<{ applicationId: string; amountMinor: string }>;
  extraLines: TSettledRecap["extraLines"];
}): TSettledRecap | null => {
  if (preview.availableExtras.length === 0 && preview.extraLines.length === 0) return null;
  return {
    currency: preview.currency,
    totalAmountMinor: preview.totalAmountMinor,
    visaLines: preview.visaLines.map((line) => ({
      applicationId: line.applicationId,
      amountMinor: line.amountMinor,
    })),
    extraLines: preview.extraLines,
  };
};
