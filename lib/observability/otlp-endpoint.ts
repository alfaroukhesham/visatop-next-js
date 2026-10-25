/**
 * Default OTLP HTTP receiver on the droplet Docker network (Grafana Alloy).
 * Used as the documented / recommended value — not as an implicit runtime fallback.
 * Leaving the env unset keeps tracing a no-op (no SDK start, no export).
 */
export const DEFAULT_ALLOY_OTLP_HTTP_ENDPOINT = "http://alloy:4318";

export const resolveConfiguredOtlpEndpoint = (
  env: Record<string, string | undefined> = process.env,
): string | undefined => {
  const traces = env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim();
  if (traces) return traces;
  const base = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (base) return base;
  return undefined;
};

export const normalizeOtlpTracesUrl = (endpoint: string): string => {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/v1/traces")) return trimmed;
  return `${trimmed}/v1/traces`;
};

export const resolveOtlpTracesUrl = (
  env: Record<string, string | undefined> = process.env,
): string | undefined => {
  const configured = resolveConfiguredOtlpEndpoint(env);
  if (!configured) return undefined;
  return normalizeOtlpTracesUrl(configured);
};

export const isTracingExportEnabled = (
  env: Record<string, string | undefined> = process.env,
): boolean => Boolean(resolveOtlpTracesUrl(env));
