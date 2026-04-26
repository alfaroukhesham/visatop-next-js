import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  // Document upload / extraction (passport OCR feature).
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "CORRUPT_IMAGE"
  | "PDF_NOT_SINGLE_PAGE"
  | "NO_PASSPORT_DOCUMENT"
  | "EXTRACTION_ALREADY_RUNNING"
  | "STALE_EXTRACTION_LEASE"
  | "CHECKOUT_FROZEN"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "PAYMENT_PROVIDER_ERROR"
  | "ZIINA_UNAVAILABLE"
  | "ZIINA_CLIENT_ERROR"
  | "WEBHOOK_SECRET_NOT_CONFIGURED"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "INVALID_OPS_STATE"
  | "INVALID_TRANSITION";

export type ApiOk<T> = {
  ok: true;
  data: T;
  meta: {
    requestId: string;
  };
};

export type ApiErr = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
  };
};

function resolveRequestId(requestId?: string | null) {
  return requestId && requestId.trim() ? requestId.trim() : crypto.randomUUID();
}

function mergeHeaders(
  existing: HeadersInit | undefined,
  patch: Record<string, string>,
): HeadersInit {
  const h = new Headers(existing);
  for (const [k, v] of Object.entries(patch)) {
    h.set(k, v);
  }
  return h;
}

export function jsonOk<T>(
  data: T,
  opts?: {
    status?: number;
    requestId?: string | null;
    headers?: HeadersInit;
  },
) {
  const requestId = resolveRequestId(opts?.requestId);
  return NextResponse.json<ApiOk<T>>(
    { ok: true, data, meta: { requestId } },
    {
      status: opts?.status ?? 200,
      headers: mergeHeaders(opts?.headers, { "x-request-id": requestId }),
    },
  );
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  opts?: {
    status?: number;
    requestId?: string | null;
    details?: unknown;
    headers?: HeadersInit;
  },
) {
  const requestId = resolveRequestId(opts?.requestId);
  return NextResponse.json<ApiErr>(
    { ok: false, error: { code, message, details: opts?.details }, meta: { requestId } },
    {
      status: opts?.status ?? 400,
      headers: mergeHeaders(opts?.headers, { "x-request-id": requestId }),
    },
  );
}

