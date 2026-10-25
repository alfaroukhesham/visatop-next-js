export type TDurationPercentiles = {
  p50Seconds: number | null;
  p95Seconds: number | null;
  sampleSize: number;
};

const asFiniteNumber = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const asInt = (value: unknown): number => {
  const n = asFiniteNumber(value);
  return n === null ? 0 : Math.max(0, Math.round(n));
};

export const toDurationPercentiles = (row: {
  p50?: unknown;
  p95?: unknown;
  n?: unknown;
}): TDurationPercentiles => {
  const sampleSize = asInt(row.n);
  if (sampleSize <= 0) {
    return { p50Seconds: null, p95Seconds: null, sampleSize: 0 };
  }
  return {
    p50Seconds: asFiniteNumber(row.p50),
    p95Seconds: asFiniteNumber(row.p95),
    sampleSize,
  };
};

export const formatDurationSeconds = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
};
