import { Environment, LogLevel, Paddle } from "@paddle/paddle-node-sdk";
import type { PaymentProvider, CreateCheckoutParams, ProviderCheckoutResult, ParsedWebhookEvent, RefundResult, PaddleRefundReason } from "./types";

const paddle = new Paddle(process.env.PADDLE_API_KEY || "dummy", {
  environment: process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? Environment.production : Environment.sandbox,
  logLevel: LogLevel.error,
});

function formatDecimalString(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

export const paddleAdapter: PaymentProvider = {
  async createCheckout(params: CreateCheckoutParams): Promise<ProviderCheckoutResult> {
    const txn = await paddle.transactions.create({
      items: [
        {
          price: {
            description: params.serviceLabel,
            unitPrice: {
              amount: formatDecimalString(params.totalAmount),
              currencyCode: params.currency as any,
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
      customer: params.customerEmail ? { email: params.customerEmail } : undefined,
    });

    return {
      transactionId: txn.id,
      clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
    };
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
    const refund = await paddle.adjustments.create({
      action: "refund",
      transactionId,
      reason: reason,
      items: [], // Full refund
    });
    return { refundId: refund.id, status: refund.status };
  }
};
