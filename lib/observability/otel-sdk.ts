import { diag, DiagConsoleLogger, DiagLogLevel, type Span } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resolveOtelResourceAttributes } from "@/lib/observability/resource-attributes";
import { resolveOtlpTracesUrl } from "@/lib/observability/otlp-endpoint";
import { applyOtelSamplerEnv } from "@/lib/observability/sampler-ratio";

let sdk: NodeSDK | null = null;

const isTruthy = (v?: string): boolean => v === "1" || v === "true" || v === "yes";

const stripQuery = (value: string): string => {
  const q = value.indexOf("?");
  return q === -1 ? value : value.slice(0, q);
};

const sanitizeHttpSpanUrls = (span: Span, request: { url?: string; path?: string }): void => {
  const raw = typeof request.url === "string" ? request.url : request.path;
  if (typeof raw === "string" && raw.length > 0) {
    span.setAttribute("http.target", stripQuery(raw));
  }
};

export const isOtelSdkStarted = (): boolean => sdk !== null;

export const startOtelNodeSdk = async (): Promise<void> => {
  if (sdk) return;

  const tracesUrl = resolveOtlpTracesUrl();
  if (!tracesUrl) return;

  if (isTruthy(process.env.OTEL_DIAGNOSTIC_LOGS)) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  applyOtelSamplerEnv();

  const resourceAttrs = resolveOtelResourceAttributes();

  sdk = new NodeSDK({
    resource: resourceFromAttributes(resourceAttrs),
    traceExporter: new OTLPTraceExporter({ url: tracesUrl }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
        "@opentelemetry/instrumentation-net": { enabled: false },
        "@opentelemetry/instrumentation-pg": { enabled: false },
        "@opentelemetry/instrumentation-pino": { enabled: false },
        "@opentelemetry/instrumentation-bunyan": { enabled: false },
        "@opentelemetry/instrumentation-winston": { enabled: false },
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingRequestHook: (req) => {
            const url = typeof req.url === "string" ? req.url : "";
            return url.includes("/api/health");
          },
          headersToSpanAttributes: {
            client: { requestHeaders: [], responseHeaders: [] },
            server: { requestHeaders: [], responseHeaders: [] },
          },
          redactedQueryParams: [
            "sig",
            "Signature",
            "token",
            "email",
            "code",
            "resume",
            "guest",
          ],
          requestHook: (span, request) => {
            sanitizeHttpSpanUrls(span, request);
          },
        },
      }),
    ],
  });

  await sdk.start();
};

export const shutdownOtelNodeSdk = async (): Promise<void> => {
  await sdk?.shutdown();
  sdk = null;
};
