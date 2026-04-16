import type { ApiErr } from "@/lib/api/response";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Browser fetch for same-origin API routes using the JSON envelope (`jsonOk` / `jsonError`).
 */
export async function fetchApiEnvelope<T>(
  input: string,
  init?: RequestInit,
): Promise<
  | { ok: true; data: T; status: number; requestId: string }
  | { ok: false; status: number; error: ApiErr["error"]; requestId: string }
> {
  const res = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const json: unknown = await res.json().catch(() => null);
  if (!isRecord(json) || typeof json.ok !== "boolean") {
    return {
      ok: false,
      status: res.status,
      requestId: "",
      error: {
        code: "INTERNAL_ERROR",
        message: "Invalid JSON response",
      },
    };
  }
  const requestId =
    isRecord(json.meta) && typeof json.meta.requestId === "string"
      ? json.meta.requestId
      : "";
  if (json.ok === true) {
    return { ok: true, data: json.data as T, status: res.status, requestId };
  }
  const errBody = json as ApiErr;
  return {
    ok: false,
    status: res.status,
    requestId,
    error: errBody.error,
  };
}
