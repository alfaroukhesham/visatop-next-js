import { resolveTraceSamplerRatio, shouldSampleTraceId } from "@/lib/observability/sampler-ratio";
import { TRACEPARENT_HEADER } from "@/lib/observability/trace-headers";

const TRACEPARENT_RE =
  /^[\s]*([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})[\s]*$/i;

export type TParsedTraceparent = {
  raw: string;
  version: string;
  traceId: string;
  parentId: string;
  sampled: boolean;
};

const isAllZero = (hex: string): boolean => /^0+$/.test(hex);

const randomHex = (byteCount: number): string => {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
};

export const parseTraceparent = (value: string | null | undefined): TParsedTraceparent | null => {
  if (!value) return null;
  const match = TRACEPARENT_RE.exec(value);
  if (!match) return null;
  const version = match[1]!.toLowerCase();
  const traceId = match[2]!.toLowerCase();
  const parentId = match[3]!.toLowerCase();
  const flags = match[4]!.toLowerCase();
  if (version === "ff") return null;
  if (isAllZero(traceId) || isAllZero(parentId)) return null;
  return {
    raw: `${version}-${traceId}-${parentId}-${flags}`,
    version,
    traceId,
    parentId,
    sampled: (Number.parseInt(flags, 16) & 0x01) === 1,
  };
};

export type TEnsuredTraceContext = {
  traceparent: string;
  traceId: string;
  sampled: boolean;
};

/**
 * Reuse a valid incoming `traceparent` so Node SDK parent-based sampling honors
 * the caller. Otherwise mint a W3C context using the same ratio algorithm as
 * `TraceIdRatioBasedSampler`.
 */
export const ensureTraceContext = (
  incomingTraceparent: string | null | undefined,
  sampleRatio: number = resolveTraceSamplerRatio(),
): TEnsuredTraceContext => {
  const parsed = parseTraceparent(incomingTraceparent);
  if (parsed) {
    return {
      traceparent: parsed.raw,
      traceId: parsed.traceId,
      sampled: parsed.sampled,
    };
  }
  const traceId = randomHex(16);
  const parentId = randomHex(8);
  const sampled = shouldSampleTraceId(traceId, sampleRatio);
  const flags = sampled ? "01" : "00";
  return {
    traceparent: `00-${traceId}-${parentId}-${flags}`,
    traceId,
    sampled,
  };
};

export const readIncomingTraceparent = (headers: Headers): string | null =>
  headers.get(TRACEPARENT_HEADER);
