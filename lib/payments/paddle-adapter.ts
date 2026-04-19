import { ApiError, Environment, LogLevel, Paddle, type CurrencyCode } from "@paddle/paddle-node-sdk";
import type { PaymentProvider, CreateCheckoutParams, ProviderCheckoutResult, ParsedWebhookEvent, RefundResult, PaddleRefundReason } from "./types";

const paddle = new Paddle(process.env.PADDLE_API_KEY || "dummy", {
  environment: process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? Environment.production : Environment.sandbox,
  logLevel: LogLevel.error,
});

/** Paddle Billing `request_error` responses — safe to show `message` to operators (no secrets). */
export class PaddleProviderError extends Error {
  readonly paddleCode: string;
  readonly httpStatus: number;

  constructor(message: string, paddleCode: string, httpStatus: number) {
    super(message);
    this.name = "PaddleProviderError";
    this.paddleCode = paddleCode;
    this.httpStatus = httpStatus;
  }
}

/** Merchant configuration issues (fix in Paddle Dashboard), not transient outages. */
const PADDLE_CONFIG_ERROR_CODES = new Set<string>(["transaction_default_checkout_url_not_set"]);

/** Paddle treats `bad_request` as client/caller fixable more often than upstream outage. */
const PADDLE_CLIENT_ERROR_CODES = new Set<string>(["bad_request", "invalid_request", "validation_error"]);

function paddleHttpStatusForCode(code: string): number {
  if (PADDLE_CONFIG_ERROR_CODES.has(code) || PADDLE_CLIENT_ERROR_CODES.has(code)) return 400;
  return 502;
}

function formatPaddleErrorMessage(detail: string, errors: { field: string; message: string }[] | null | undefined): string {
  if (!errors?.length) return detail;
  const parts = errors.map((x) => `${x.field}: ${x.message}`).filter(Boolean);
  if (!parts.length) return detail;
  return `${detail} (${parts.join("; ")})`;
}

function toPaddleProviderError(e: unknown): PaddleProviderError | null {
  if (e instanceof ApiError) {
    const msg = formatPaddleErrorMessage(e.detail, e.errors);
    return new PaddleProviderError(msg, e.code, paddleHttpStatusForCode(e.code));
  }
  if (!e || typeof e !== "object") return null;
  const rec = e as Record<string, unknown>;
  if (rec.type !== "request_error" || typeof rec.detail !== "string") return null;
  const code = typeof rec.code === "string" ? rec.code : "unknown";
  const errors = Array.isArray(rec.errors) ? (rec.errors as { field: string; message: string }[]) : undefined;
  return new PaddleProviderError(formatPaddleErrorMessage(rec.detail, errors), code, paddleHttpStatusForCode(code));
}

/** `unit_price.amount` must be in the smallest currency unit (e.g. USD cents), integer string — not major units. */
function amountMinorToPaddleAmountString(minorUnits: number): string {
  return String(Math.max(0, Math.round(minorUnits)));
}

function toPaddleCurrencyCode(raw: string): CurrencyCode {
  return raw.trim().toUpperCase() as CurrencyCode;
}

export const paddleAdapter: PaymentProvider = {
  async createCheckout(params: CreateCheckoutParams): Promise<ProviderCheckoutResult> {
    try {
      const currencyCode = toPaddleCurrencyCode(params.currency);
      const txn = await paddle.transactions.create({
        currencyCode,
        items: [
          {
            price: {
              name: params.serviceLabel,
              description: params.serviceLabel,
              unitPrice: {
                amount: amountMinorToPaddleAmountString(params.totalAmount),
                currencyCode,
              },
              product: {
                name: params.serviceLabel,
                taxCategory: "standard",
              },
            },
            quantity: 1,
          },
        ],
        customData: params.metadata,
      });

      return {
        transactionId: txn.id,
        clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
      };
    } catch (e: unknown) {
      const pe = toPaddleProviderError(e);
      if (pe) throw pe;
      throw e instanceof Error ? e : new Error(String(e));
    }
  },

  verifyWebhookSignature(body: string, signature: string): boolean {
    const secret = process.env.PADDLE_WEBHOOK_SECRET;
    if (!secret) return false;
    // In a real implementation, use paddle.webhooks.unmarshal with try/catch
    // For now, assume unmarshal throws if invalid
    try {
      paddle.webhooks.unmarshal(body, secret, signature);
      return true;
    } catch {
      return false;
    }
  },

  parseWebhookEvent(body: string): ParsedWebhookEvent {
    // Basic parser for demonstration/mock
    const payload = JSON.parse(body);
    const data = payload.data;
    
    // Attempt to extract total amount from details or fallback
    let amountStr = "0.00";
    if (data.details?.totals?.total) {
      amountStr = data.details.totals.total;
    } else if (data.amount) {
      amountStr = data.amount;
    }

    return {
      type: payload.event_type,
      transactionId: data.id || data.transaction_id,
      amountMinor: Math.round(parseFloat(amountStr) * 100),
      metadata: data.custom_data || {},
    };
  },

  async initiateRefund(transactionId: string, reason: PaddleRefundReason, amountMinor?: number): Promise<RefundResult> {
    if (amountMinor) {
      throw new Error("NotImplemented: Partial refunds are not supported in MVP.");
    }
    // Full refund: omit `items`. Empty `items` is rejected ("Array must have at least one item");
    // partial refunds require line items — see CreateFullAdjustmentRequestBody in @paddle/paddle-node-sdk.
    try {
      const refund = await paddle.adjustments.create({
        action: "refund",
        transactionId,
        reason,
        type: "full",
      });
      return { refundId: refund.id, status: refund.status };
    } catch (e: unknown) {
      const pe = toPaddleProviderError(e);
      if (pe) throw pe;
      throw e instanceof Error ? e : new Error(String(e));
    }
  }
};
