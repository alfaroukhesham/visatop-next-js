export class ZiinaProviderError extends Error {
  readonly httpStatus: number;
  readonly ziinaBody?: string;

  constructor(message: string, httpStatus: number, ziinaBody?: string) {
    super(message);
    this.name = "ZiinaProviderError";
    this.httpStatus = httpStatus;
    this.ziinaBody = ziinaBody;
  }
}

export type CreateZiinaPaymentIntentParams = {
  baseUrl: string;
  accessToken: string;
  amountMinor: number; // JSON-safe minor units (see minorUnitsToJsonSafeNumber)
  currencyCode: string;
  message: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  test: boolean;
  operationId: string;
  timeoutMs?: number;
};

export type ZiinaPaymentIntentCreated = {
  id: string;
  redirectUrl: string;
  embeddedUrl: string;
  operationId: string;
};

export type ZiinaPaymentIntentRecord = {
  id: string;
  status: string;
  amountMinor: number;
  currencyCode: string;
  operationId: string | null;
  embeddedUrl: string | null;
  raw: Record<string, unknown>;
};

const readRecordString = (rec: Record<string, unknown>, key: string): string =>
  typeof rec[key] === "string" ? rec[key] : "";

export const parseZiinaPaymentIntentCreated = (
  json: unknown,
  fallbackOperationId: string,
): ZiinaPaymentIntentCreated => {
  if (typeof json !== "object" || json === null) {
    throw new ZiinaProviderError("Ziina payment_intent returned non-object JSON", 502);
  }
  const rec = json as Record<string, unknown>;
  const id = readRecordString(rec, "id");
  const redirectUrl = readRecordString(rec, "redirect_url");
  const embeddedUrl = readRecordString(rec, "embedded_url");
  const operationId = readRecordString(rec, "operation_id") || fallbackOperationId;
  if (!id || !embeddedUrl) {
    throw new ZiinaProviderError(
      "Ziina payment_intent response missing id or embedded_url",
      502,
    );
  }
  return { id, redirectUrl, embeddedUrl, operationId };
};

export async function createZiinaPaymentIntent(
  params: CreateZiinaPaymentIntentParams,
): Promise<ZiinaPaymentIntentCreated> {
  const url = `${params.baseUrl.replace(/\/$/, "")}/payment_intent`;
  const body = {
    amount: params.amountMinor,
    currency_code: params.currencyCode.trim().toUpperCase(),
    message: params.message,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    failure_url: params.failureUrl,
    test: params.test,
    operation_id: params.operationId,
    allow_tips: false,
  };

  const controller = new AbortController();
  const timeoutMs = Math.max(500, Math.round(params.timeoutMs ?? 8000));
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new ZiinaProviderError(
      aborted ? `Ziina payment_intent timed out after ${timeoutMs}ms` : "Ziina payment_intent request failed",
      502,
    );
  } finally {
    clearTimeout(t);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new ZiinaProviderError(
      `Ziina payment_intent failed (HTTP ${res.status})`,
      res.status >= 500 ? 502 : res.status >= 400 ? 400 : 502,
      text.slice(0, 500),
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ZiinaProviderError("Ziina payment_intent returned non-JSON", 502, text.slice(0, 200));
  }
  try {
    return parseZiinaPaymentIntentCreated(json, params.operationId);
  } catch (e) {
    if (e instanceof ZiinaProviderError) {
      throw new ZiinaProviderError(e.message, e.httpStatus, text.slice(0, 300));
    }
    throw e;
  }
}

export async function getZiinaPaymentIntent(params: {
  baseUrl: string;
  accessToken: string;
  paymentIntentId: string;
  timeoutMs?: number;
}): Promise<ZiinaPaymentIntentRecord> {
  const endpoint = `${params.baseUrl.replace(/\/$/, "")}/payment_intent/${encodeURIComponent(params.paymentIntentId)}`;
  const res = await ziinaFetchJson(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: "application/json",
    },
    timeoutMs: params.timeoutMs,
  });
  if (!res.ok) {
    throw new ZiinaProviderError(
      `Ziina get payment_intent failed (HTTP ${res.status})`,
      res.status >= 500 ? 502 : res.status >= 400 ? 400 : 502,
      res.text.slice(0, 500),
    );
  }
  const rec = res.json;
  const id = typeof rec.id === "string" ? rec.id : "";
  const status = typeof rec.status === "string" ? rec.status : "";
  const amountRaw = rec.amount;
  const amount =
    typeof amountRaw === "number" ? amountRaw : typeof amountRaw === "string" ? Number(amountRaw) : NaN;
  const currencyCode =
    typeof rec.currency_code === "string" ? rec.currency_code.trim().toUpperCase() : "USD";
  const operationId = typeof rec.operation_id === "string" ? rec.operation_id : null;
  const embeddedUrl = typeof rec.embedded_url === "string" ? rec.embedded_url : null;
  if (!id || !status) {
    throw new ZiinaProviderError("Ziina payment_intent response missing id or status", 502);
  }
  return {
    id,
    status,
    amountMinor: Number.isFinite(amount) ? amount : 0,
    currencyCode,
    operationId,
    embeddedUrl,
    raw: rec,
  };
}

export type InitiateZiinaRefundParams = {
  baseUrl: string;
  accessToken: string;
  refundClientId: string;
  paymentIntentId: string;
  test: boolean;
  timeoutMs?: number;
};

export type ZiinaRefundResult = {
  refundId: string;
  status: string;
};

export type ZiinaWebhookResponse = {
  success: boolean;
  error?: string | null;
};

async function ziinaFetchJson(
  input: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; status: number; text: string }> {
  const controller = new AbortController();
  const timeoutMs = Math.max(500, Math.round(init.timeoutMs ?? 8000));
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, text };
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, status: 502, text };
    }
    return { ok: true, json: (json as Record<string, unknown>) ?? {} };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new ZiinaProviderError(aborted ? `Ziina request timed out after ${timeoutMs}ms` : "Ziina request failed", 502);
  } finally {
    clearTimeout(t);
  }
}

export async function setZiinaWebhook(params: {
  baseUrl: string;
  accessToken: string;
  url: string;
  secret: string;
  timeoutMs?: number;
}): Promise<ZiinaWebhookResponse> {
  const endpoint = `${params.baseUrl.replace(/\/$/, "")}/webhook`;
  const res = await ziinaFetchJson(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ url: params.url, secret: params.secret }),
    timeoutMs: params.timeoutMs,
  });
  if (!res.ok) {
    throw new ZiinaProviderError(`Ziina webhook setup failed (HTTP ${res.status})`, res.status >= 500 ? 502 : 400, res.text.slice(0, 500));
  }
  return {
    success: Boolean(res.json.success),
    error: typeof res.json.error === "string" ? res.json.error : null,
  };
}

export async function deleteZiinaWebhook(params: {
  baseUrl: string;
  accessToken: string;
  timeoutMs?: number;
}): Promise<ZiinaWebhookResponse> {
  const endpoint = `${params.baseUrl.replace(/\/$/, "")}/webhook`;
  const res = await ziinaFetchJson(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: "application/json",
    },
    timeoutMs: params.timeoutMs,
  });
  if (!res.ok) {
    throw new ZiinaProviderError(`Ziina webhook delete failed (HTTP ${res.status})`, res.status >= 500 ? 502 : 400, res.text.slice(0, 500));
  }
  return {
    success: Boolean(res.json.success),
    error: typeof res.json.error === "string" ? res.json.error : null,
  };
}

export async function initiateZiinaRefund(params: InitiateZiinaRefundParams): Promise<ZiinaRefundResult> {
  const url = `${params.baseUrl.replace(/\/$/, "")}/refund`;
  const body: Record<string, unknown> = {
    id: params.refundClientId,
    payment_intent_id: params.paymentIntentId,
    test: params.test,
  };

  const controller = new AbortController();
  const timeoutMs = Math.max(500, Math.round(params.timeoutMs ?? 8000));
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new ZiinaProviderError(
      aborted ? `Ziina refund timed out after ${timeoutMs}ms` : "Ziina refund request failed",
      502,
    );
  } finally {
    clearTimeout(t);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new ZiinaProviderError(
      `Ziina refund failed (HTTP ${res.status})`,
      res.status >= 500 ? 502 : res.status >= 400 ? 400 : 502,
      text.slice(0, 500),
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ZiinaProviderError("Ziina refund returned non-JSON", 502, text.slice(0, 200));
  }
  const rec = json as Record<string, unknown>;
  const refundId = typeof rec.id === "string" ? rec.id : "";
  const status = typeof rec.status === "string" ? rec.status : "unknown";
  if (!refundId) {
    throw new ZiinaProviderError("Ziina refund response missing id", 502, text.slice(0, 300));
  }
  return { refundId, status };
}
