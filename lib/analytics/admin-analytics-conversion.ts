export type TConversionDimensionRow = {
  key: string;
  created: number;
  paid: number;
};

const asInt = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const conversionPctForDimension = (paid: number, created: number): number | null => {
  if (created <= 0) return null;
  return (paid / created) * 100;
};

export const toConversionDimensionRows = (
  rows: Array<{ key: string | null; created: unknown; paid: unknown }>,
): TConversionDimensionRow[] =>
  rows.map((row) => ({
    key: row.key && row.key.trim() ? row.key.trim() : "unknown",
    created: asInt(row.created),
    paid: asInt(row.paid),
  }));

const fincraEventFailureCode = (type: string): string => {
  if (type === "charge.expired") return "expired";
  if (type === "charge.failed") return "failed";
  return type;
};

export const mergePaymentFailureBreakdown = (
  fincraEventRows: Array<{ type: string; count: unknown }>,
  otherPaymentRows: Array<{ provider: string; code: string | null; count: unknown }>,
): Array<{ code: string; count: number }> => {
  const counts = new Map<string, number>();
  const add = (code: string, count: unknown) => {
    counts.set(code, (counts.get(code) ?? 0) + asInt(count));
  };
  for (const row of fincraEventRows) {
    add(`fincra:${fincraEventFailureCode(row.type)}`, row.count);
  }
  for (const row of otherPaymentRows) {
    if (!row.code) continue;
    add(`${row.provider || "unknown"}:${row.code}`, row.count);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
};
