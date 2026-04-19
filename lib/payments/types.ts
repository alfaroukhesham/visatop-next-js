export type CreateCheckoutParams = {
  applicationId: string;
  priceQuoteId: string;
  totalAmount: number; // minor units (adapter converts to string decimal)
  currency: string;
  serviceLabel: string;
  customerEmail?: string | null;
  metadata: Record<string, string>;
};

export type ProviderCheckoutResult = {
  transactionId: string;
  clientToken: string;
};

export type ParsedWebhookEvent = {
  type: "transaction.completed" | "transaction.payment_failed" | "transaction.updated" | "refund.completed" | string;
  transactionId: string;
  amountMinor: number;
  metadata: Record<string, string>;
};

export type RefundResult = {
  refundId: string;
  status: string;
};

export type PaddleRefundReason = "fraud" | "accidental" | "customer_request";

export interface PaymentProvider {
  createCheckout(params: CreateCheckoutParams): Promise<ProviderCheckoutResult>;
  verifyWebhookSignature(body: string, signature: string): Promise<boolean>;
  parseWebhookEvent(body: string): ParsedWebhookEvent;
  initiateRefund(transactionId: string, reason: PaddleRefundReason, amountMinor?: number): Promise<RefundResult>;
}
