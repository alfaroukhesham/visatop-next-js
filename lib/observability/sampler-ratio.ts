/**
 * Head-sampling ratio for parent-based TraceIdRatioBased sampling.
 * Default 1.0 — this app is low traffic; keep errors/slow traces at the collector.
 */
export const DEFAULT_TRACE_SAMPLER_RATIO = 1;

const parseRatio = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
};

/**
 * Reads `OTEL_TRACES_SAMPLER_RATIO`, then standard `OTEL_TRACES_SAMPLER_ARG`.
 * Never consults NODE_ENV.
 */
export const resolveTraceSamplerRatio = (
  env: Record<string, string | undefined> = process.env,
): number => {
  const fromApp = parseRatio(env.OTEL_TRACES_SAMPLER_RATIO);
  if (fromApp !== undefined) return fromApp;
  const fromOtel = parseRatio(env.OTEL_TRACES_SAMPLER_ARG);
  if (fromOtel !== undefined) return fromOtel;
  return DEFAULT_TRACE_SAMPLER_RATIO;
};

/**
 * OpenTelemetry JS `TraceIdRatioBasedSampler` accumulator: XOR of 8-hex chunks
 * of the 32-char trace id, compared to `floor(ratio * 0xffffffff)`.
 */
/**
 * Parent-based ratio sampler via standard OTEL env, applied only if the
 * operator has not already set `OTEL_TRACES_SAMPLER`.
 */
export const applyOtelSamplerEnv = (
  env: Record<string, string | undefined> = process.env,
): void => {
  if (!env.OTEL_TRACES_SAMPLER?.trim()) {
    env.OTEL_TRACES_SAMPLER = "parentbased_traceidratio";
  }
  if (!env.OTEL_TRACES_SAMPLER_ARG?.trim()) {
    env.OTEL_TRACES_SAMPLER_ARG = String(resolveTraceSamplerRatio(env));
  }
};

export const shouldSampleTraceId = (traceId: string, ratio: number): boolean => {
  if (ratio <= 0) return false;
  if (ratio >= 1) return true;
  if (!/^[0-9a-f]{32}$/i.test(traceId)) return false;
  const upperBound = Math.floor(ratio * 0xffffffff);
  let accumulation = 0;
  for (let i = 0; i < traceId.length / 8; i += 1) {
    const pos = i * 8;
    const part = Number.parseInt(traceId.slice(pos, pos + 8), 16);
    accumulation = (accumulation ^ part) >>> 0;
  }
  return accumulation < upperBound;
};
