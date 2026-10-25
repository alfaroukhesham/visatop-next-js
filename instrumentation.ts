/**
 * Next.js instrumentation hook.
 *
 * GlitchTip (`registerSentry` / `onRequestError`) is DSN-gated.
 * Tracing NodeSDK is a dynamic import gated on OTEL_EXPORTER_OTLP_ENDPOINT —
 * do not import the SDK at the top level or local/CI pays the startup cost.
 */
import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/observability/sentry-env";

const registerSentry = async () => {
  if (!isSentryEnabled()) return;
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
    return;
  }
  await import("./sentry.server.config");
};

export const onRequestError: typeof Sentry.captureRequestError = (...args) => {
  if (!isSentryEnabled()) return;
  Sentry.captureRequestError(...args);
};

export const register = async () => {
  await registerSentry();
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { registerTracing } = await import("./lib/observability/register-tracing");
  await registerTracing();
};

export const shutdown = async () => {
  const { shutdownTracing } = await import("./lib/observability/register-tracing");
  await shutdownTracing();
};
