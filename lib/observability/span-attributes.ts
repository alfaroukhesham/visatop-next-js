import type { Span } from "@opentelemetry/api";

/**
 * Only low-cardinality identifiers and status/error codes may go on spans.
 * Never attach bodies, headers, emails, names, passport data, or OCR output.
 */
const ALLOWED_SPAN_ATTRIBUTE_KEYS = new Set([
  "applicationId",
  "paymentId",
  "provider",
  "status",
  "errorCode",
  "http.status_code",
  "requestId",
  "slot",
  "outcome",
  "attempt",
  "operation",
]);

const DENIED_KEY_PATTERN =
  /(email|name|passport|ocr|body|header|cookie|token|secret|password|phone|address|mrz|rawtext|payload|authorization)/i;

export type TSafeSpanAttributeValue = string | number | boolean;
export type TSafeSpanAttributes = Record<string, TSafeSpanAttributeValue | undefined | null>;

const MAX_STRING_ATTR_LENGTH = 128;

const normalizeValue = (value: TSafeSpanAttributeValue): TSafeSpanAttributeValue | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.length > MAX_STRING_ATTR_LENGTH
      ? trimmed.slice(0, MAX_STRING_ATTR_LENGTH)
      : trimmed;
  }
  if (typeof value === "number" && !Number.isFinite(value)) return undefined;
  return value;
};

export const pickSafeSpanAttributes = (
  attributes: TSafeSpanAttributes,
): Record<string, TSafeSpanAttributeValue> => {
  const out: Record<string, TSafeSpanAttributeValue> = {};
  for (const [key, raw] of Object.entries(attributes)) {
    if (raw === undefined || raw === null) continue;
    if (!ALLOWED_SPAN_ATTRIBUTE_KEYS.has(key)) continue;
    if (DENIED_KEY_PATTERN.test(key)) continue;
    const value = normalizeValue(raw);
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
};

export const setSafeSpanAttributes = (span: Span, attributes: TSafeSpanAttributes): void => {
  if (!span.isRecording()) return;
  const safe = pickSafeSpanAttributes(attributes);
  for (const [key, value] of Object.entries(safe)) {
    span.setAttribute(key, value);
  }
};
