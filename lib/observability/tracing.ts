import { SpanStatusCode, context, trace, type Span } from "@opentelemetry/api";
import {
  pickSafeSpanAttributes,
  setSafeSpanAttributes,
  type TSafeSpanAttributes,
} from "@/lib/observability/span-attributes";
import { DEFAULT_OTEL_SERVICE_NAME } from "@/lib/observability/resource-attributes";

export type { TSafeSpanAttributes, TSafeSpanAttributeValue } from "@/lib/observability/span-attributes";
export { pickSafeSpanAttributes, setSafeSpanAttributes };

const tracer = () => trace.getTracer(DEFAULT_OTEL_SERVICE_NAME);

const spanErrorCode = (err: unknown): string => {
  if (!err || typeof err !== "object") return "UNKNOWN";
  const rec = err as { code?: unknown; name?: unknown };
  if (typeof rec.code === "string" && rec.code.trim()) return rec.code.trim().slice(0, 128);
  if (typeof rec.name === "string" && rec.name.trim()) return rec.name.trim().slice(0, 128);
  return "UNKNOWN";
};

export const getCurrentTraceId = (): string | undefined => {
  const span = trace.getSpan(context.active());
  const spanContext = span?.spanContext();
  if (!spanContext) return undefined;
  if (!trace.isSpanContextValid(spanContext)) return undefined;
  return spanContext.traceId;
};

/**
 * Manual span helper. No-op when the NodeSDK is not started (no OTLP endpoint).
 * Attribute values are allowlisted — never pass bodies, PII, or OCR results.
 */
export const withSpan = async <T>(
  name: string,
  attributes: TSafeSpanAttributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> => {
  const safe = pickSafeSpanAttributes(attributes);
  return tracer().startActiveSpan(name, { attributes: safe }, async (span) => {
    try {
      const result = await fn(span);
      if (span.isRecording()) {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      return result;
    } catch (err) {
      if (span.isRecording()) {
        const errorCode = spanErrorCode(err);
        setSafeSpanAttributes(span, { errorCode, status: "error" });
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorCode });
      }
      throw err;
    } finally {
      span.end();
    }
  });
};
