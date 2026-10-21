import type { FincraFeeBearer } from "@/lib/payments/resolve-payment-provider";
import { tryFincraMajorToMinor } from "@/lib/payments/fincra-amounts";

export class FincraProviderError extends Error {
  readonly httpStatus: number;
  readonly fincraBody?: string;
  readonly errorType?: string;

  constructor(message: string, httpStatus: number, fincraBody?: string, errorType?: string) {
    super(message);
    this.name = "FincraProviderError";
    this.httpStatus = httpStatus;
    this.fincraBody = fincraBody;
    this.errorType = errorType;
  }
}

const readRecord = (json: unknown): Record<string, unknown> => {
  if (typeof json !== "object" || json === null) {
    throw new FincraProviderError("Fincra returned non-object JSON", 502);
  }
  return json as Record<string, unknown>;
};

const readString = (rec: Record<string, unknown>, key: string): string =>
  typeof rec[key] === "string" ? rec[key] : "";

const unwrapData = (json: unknown): Record<string, unknown> => {
  const rec = readRecord(json);
  const { data } = rec;
  if (typeof data !== "object" || data === null) {
    throw new FincraProviderError("Fincra response missing data object", 502);
  }
  return data as Record<string, unknown>;
};

export type CreateFincraCheckoutParams = {
  apiBaseUrl: string;
  secretKey: string;
  publicKey: string;
  amountMajor: number;
  currency: string;
  reference: string;
  redirectUrl: string;
  customer: { name: string; email: string; phoneNumber?: string | null };
  feeBearer: FincraFeeBearer;
  metadata: Record<string, string>;
  paymentMethods?: string[];
  timeoutMs?: number;
};

export type FincraCheckoutCreated = {
  link: string;
  payCode: string;
  reference: string | null;
};

export const parseFincraCheckoutCreated = (json: unknown): FincraCheckoutCreated => {
  const data = unwrapData(json);
  const link = readString(data, "link");
  const payCode = readString(data, "payCode") || readString(data, "pay_code");
  const reference = readString(data, "reference") || null;
  if (!link || !payCode) {
    throw new FincraProviderError("Fincra checkout response missing link or payCode", 502);
  }
  return { link, payCode, reference };
};

export type FincraVerifiedPayment = {
  id: string;
  status: string;
  currency: string;
  amountMinor: bigint;
  amountReceivedMinor: bigint | null;
  amountExpectedMinor: bigint | null;
  varianceType: string | null;
  message: string | null;
  merchantReference: string | null;
  reference: string | null;
  feeMinor: bigint | null;
  raw: Record<string, unknown>;
};

export const parseFincraVerifiedPayment = (json: unknown): FincraVerifiedPayment => {
  const data = unwrapData(json);
  const idRaw = data.id;
  const id =
    typeof idRaw === "number" || typeof idRaw === "string" ? String(idRaw) : "";
  const status = readString(data, "status").trim().toLowerCase();
  const currency = readString(data, "currency").trim().toUpperCase() || "NGN";
  const amountMinor = tryFincraMajorToMinor(data.amount) ?? BigInt(0);
  const amountReceivedMinor = tryFincraMajorToMinor(data.amountReceived);
  const amountExpectedMinor = tryFincraMajorToMinor(data.amountExpected);
  const varianceType =
    typeof data.varianceType === "string" && data.varianceType.trim()
      ? data.varianceType.trim().toLowerCase()
      : null;
  const message = typeof data.message === "string" && data.message.trim() ? data.message : null;
  const merchantReference =
    readString(data, "merchantReference") || readString(data, "merchant_reference") || null;
  const reference = readString(data, "reference") || null;
  const feeMinor = tryFincraMajorToMinor(data.fee);
  if (!id || !status) {
    throw new FincraProviderError("Fincra verify response missing id or status", 502);
  }
  return {
    id,
    status,
    currency,
    amountMinor,
    amountReceivedMinor,
    amountExpectedMinor,
    varianceType,
    message,
    merchantReference,
    reference,
    feeMinor,
    raw: data,
  };
};

export type FincraRefundResult = {
  refundId: string;
  status: string;
  alreadyInitiated: boolean;
};

export const parseFincraRefundResult = (
  json: unknown,
  httpStatus: number,
): FincraRefundResult => {
  const rec = readRecord(json);
  const error = typeof rec.error === "string" ? rec.error : "";
  if (httpStatus === 422 || /refund already initiated/i.test(error)) {
    const data = rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : {};
    return {
      refundId: readString(data, "reference") || "already-initiated",
      status: "already_initiated",
      alreadyInitiated: true,
    };
  }
  const data = unwrapData(json);
  const refundId = readString(data, "reference");
  if (!refundId) {
    throw new FincraProviderError("Fincra refund response missing reference", 502);
  }
  return { refundId, status: "initiated", alreadyInitiated: false };
};

const fincraFetchJson = async (
  input: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<{ ok: true; json: unknown; status: number } | { ok: false; status: number; text: string }> => {
  const controller = new AbortController();
  const { timeoutMs: timeoutRaw, ...fetchInit } = init;
  const timeoutMs = Math.max(500, Math.round(timeoutRaw ?? 8000));
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...fetchInit, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, text };
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, status: 502, text };
    }
    return { ok: true, json, status: res.status };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new FincraProviderError(
      aborted ? `Fincra request timed out after ${timeoutMs}ms` : "Fincra request failed",
      502,
    );
  } finally {
    clearTimeout(t);
  }
};

export const createFincraCheckout = async (
  params: CreateFincraCheckoutParams,
): Promise<FincraCheckoutCreated> => {
  const url = `${params.apiBaseUrl.replace(/\/$/, "")}/checkout/payments`;
  const customer: Record<string, string> = {
    name: params.customer.name,
    email: params.customer.email,
  };
  const phone = params.customer.phoneNumber?.trim();
  if (phone) customer.phoneNumber = phone;

  const body = {
    amount: params.amountMajor,
    currency: params.currency.trim().toUpperCase(),
    redirectUrl: params.redirectUrl,
    reference: params.reference,
    feeBearer: params.feeBearer,
    paymentMethods: params.paymentMethods ?? ["card", "bank_transfer"],
    customer,
    metadata: params.metadata,
  };

  const res = await fincraFetchJson(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "api-key": params.secretKey,
      "x-pub-key": params.publicKey,
    },
    body: JSON.stringify(body),
    timeoutMs: params.timeoutMs,
  });
  if (!res.ok) {
    throw new FincraProviderError(
      `Fincra checkout failed (HTTP ${res.status})`,
      res.status >= 500 ? 502 : res.status >= 400 ? 400 : 502,
      res.text.slice(0, 500),
    );
  }
  return parseFincraCheckoutCreated(res.json);
};

export const verifyFincraCheckoutByMerchantReference = async (params: {
  apiBaseUrl: string;
  secretKey: string;
  businessId: string;
  merchantReference: string;
  timeoutMs?: number;
}): Promise<FincraVerifiedPayment> => {
  const url = `${params.apiBaseUrl.replace(/\/$/, "")}/checkout/payments/merchant-reference/${encodeURIComponent(params.merchantReference)}`;
  const res = await fincraFetchJson(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "api-key": params.secretKey,
      "x-business-id": params.businessId,
    },
    timeoutMs: params.timeoutMs,
  });
  if (!res.ok) {
    throw new FincraProviderError(
      `Fincra verify failed (HTTP ${res.status})`,
      res.status >= 500 ? 502 : res.status >= 400 ? 400 : 502,
      res.text.slice(0, 500),
    );
  }
  return parseFincraVerifiedPayment(res.json);
};

export const initiateFincraRefund = async (params: {
  apiBaseUrl: string;
  secretKey: string;
  transReference: string;
  timeoutMs?: number;
}): Promise<FincraRefundResult> => {
  const url = `${params.apiBaseUrl.replace(/\/$/, "")}/collections/refund`;
  const controller = new AbortController();
  const timeoutMs = Math.max(500, Math.round(params.timeoutMs ?? 8000));
  const t = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "api-key": params.secretKey,
      },
      body: JSON.stringify({ transReference: params.transReference }),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new FincraProviderError(
      aborted ? `Fincra refund timed out after ${timeoutMs}ms` : "Fincra refund request failed",
      502,
    );
  } finally {
    clearTimeout(t);
  }

  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new FincraProviderError("Fincra refund returned non-JSON", 502, text.slice(0, 200));
  }

  if (res.status === 422) {
    return parseFincraRefundResult(json, 422);
  }
  if (!res.ok) {
    const rec = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
    const errMsg = typeof rec.error === "string" ? rec.error : `Fincra refund failed (HTTP ${res.status})`;
    throw new FincraProviderError(
      errMsg,
      res.status >= 500 ? 502 : res.status,
      text.slice(0, 500),
      typeof rec.errorType === "string" ? rec.errorType : undefined,
    );
  }
  return parseFincraRefundResult(json, res.status);
};
