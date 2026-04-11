import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

let sdk: NodeSDK | null = null;

function isTruthy(v?: string) {
  return v === "1" || v === "true" || v === "yes";
}

export async function register() {
  // Next.js calls `register()` in supported runtimes.
  // Keep this server-only; do not attempt to initialize in edge.
  if (process.env.NEXT_RUNTIME === "edge") return;

  if (sdk) return;

  // Keep OTel internal logging quiet by default; enable via env when debugging.
  if (isTruthy(process.env.OTEL_DIAGNOSTIC_LOGS)) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  const serviceName = process.env.OTEL_SERVICE_NAME ?? "visatop-next-js";
  const exporterUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const traceExporter = exporterUrl
    ? new OTLPTraceExporter({ url: exporterUrl })
    : undefined;

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV ?? "development",
    }),
    // If no exporter is configured, SDK will still create spans but not export them.
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-http": {
          // Do not capture request/response headers or bodies.
          // Keep spans minimal to avoid leaking sensitive data.
          requestHook: (span) => {
            // Ensure no accidental attributes are attached later by hooks.
            // (This is defensive; we avoid setting any request-related attributes here.)
            span.setAttribute("app.safe", true);
          },
          responseHook: (span) => {
            span.setAttribute("app.safe", true);
          },
        },
      }),
    ],
  });

  await sdk.start();
}

export async function shutdown() {
  await sdk?.shutdown();
  sdk = null;
}

