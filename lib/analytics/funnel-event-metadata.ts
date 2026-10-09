export const FUNNEL_UPLOAD_REASONS = [
  "timeout",
  "cancelled",
  "network_error",
  "server_error",
  "upload_rejected",
  "file_too_large",
  "upload_failed",
] as const;

export type TFunnelUploadReason = (typeof FUNNEL_UPLOAD_REASONS)[number];

export type TFunnelEventMetadata = {
  error_code?: string;
  http_status?: number;
  reason?: TFunnelUploadReason;
};

const ERROR_CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
const REASONS = new Set<string>(FUNNEL_UPLOAD_REASONS);

export const sanitizeFunnelErrorCode = (raw: unknown): string | undefined => {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().toUpperCase();
  return ERROR_CODE_RE.test(value) ? value : undefined;
};

export const sanitizeFunnelHttpStatus = (raw: unknown): number | undefined => {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 100 || n > 599) return undefined;
  return n;
};

export const sanitizeFunnelReason = (raw: unknown): TFunnelUploadReason | undefined => {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "server_reject" || value === "server reject") return "upload_rejected";
  return REASONS.has(value) ? (value as TFunnelUploadReason) : undefined;
};

export const funnelEventMetadataFromFields = (input: {
  errorCode?: unknown;
  httpStatus?: unknown;
  reason?: unknown;
}): TFunnelEventMetadata | null => {
  const metadata: TFunnelEventMetadata = {};
  const errorCode = sanitizeFunnelErrorCode(input.errorCode);
  const httpStatus = sanitizeFunnelHttpStatus(input.httpStatus);
  const reason = sanitizeFunnelReason(input.reason);
  if (errorCode) metadata.error_code = errorCode;
  if (httpStatus !== undefined) metadata.http_status = httpStatus;
  if (reason) metadata.reason = reason;
  return Object.keys(metadata).length > 0 ? metadata : null;
};
