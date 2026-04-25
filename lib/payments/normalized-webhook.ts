export type PaymentWebhookProvider = "paddle" | "ziina";

/** Normalized lifecycle for shared webhook apply logic (spec §15). */
export type PaymentWebhookKind = "payment_completed" | "payment_failed";

export type NormalizedPaymentWebhookEvent = {
  provider: PaymentWebhookProvider;
  kind: PaymentWebhookKind;
  /** Provider payment / transaction id used to resolve `payment` rows. */
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  metadata: Record<string, string>;
  rawEventType: string;
  providerEventId?: string | null;
};
