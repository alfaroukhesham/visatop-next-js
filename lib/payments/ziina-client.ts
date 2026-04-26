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
  amountMinor: number;
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
  operationId: string;
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
  const rec = json as Record<string, unknown>;
  const id = typeof rec.id === "string" ? rec.id : "";
  const redirectUrl = typeof rec.redirect_url === "string" ? rec.redirect_url : "";
  const operationId =
    typeof rec.operation_id === "string" ? rec.operation_id : params.operationId;
  if (!id || !redirectUrl) {
    throw new ZiinaProviderError("Ziina payment_intent response missing id or redirect_url", 502, text.slice(0, 300));
  }
  return { id, redirectUrl, operationId };
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
