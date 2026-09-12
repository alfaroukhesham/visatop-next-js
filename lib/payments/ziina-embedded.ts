export const ZIINA_CHECKOUT_ORIGIN = "https://pay.ziina.com";
export const ZIINA_EMBEDDED_VERSION = "v1";
export const ZIINA_PAYMENT_STATUS_EVENT = "ZIINA_PAYMENT_STATUS_CHANGE";

export const ZIINA_OPEN_INTENT_STATUSES = new Set([
  "requires_payment_instrument",
  "requires_user_action",
  "pending",
]);

export type TZiinaPaymentWidgetStatus = "COMPLETED" | "FAILED" | "CANCELED";

const isZiinaCheckoutHostname = (hostname: string): boolean => {
  const host = hostname.trim().toLowerCase();
  return host === "pay.ziina.com" || host.endsWith(".ziina.com");
};

export const isTrustedZiinaEmbeddedUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && isZiinaCheckoutHostname(url.hostname);
  } catch {
    return false;
  }
};

export const isZiinaIntentOpen = (status: string): boolean =>
  ZIINA_OPEN_INTENT_STATUSES.has(status.trim().toLowerCase());

export const buildZiinaEmbeddedCheckoutSrc = (embeddedUrl: string, locale?: string): string => {
  const url = new URL(embeddedUrl);
  url.searchParams.set("version", ZIINA_EMBEDDED_VERSION);
  if (locale?.trim().toLowerCase() === "ar") {
    url.searchParams.set("locale", "ar");
  } else {
    url.searchParams.delete("locale");
  }
  return url.toString();
};

export const parseZiinaCheckoutMessage = (params: {
  event: Pick<MessageEvent, "origin" | "source" | "data">;
  expectedSource: MessageEventSource | null;
}): TZiinaPaymentWidgetStatus | null => {
  const { event, expectedSource } = params;
  if (event.origin !== ZIINA_CHECKOUT_ORIGIN) return null;
  if (!expectedSource || event.source !== expectedSource) return null;

  const payload = event.data;
  if (typeof payload !== "object" || payload === null) return null;
  const rec = payload as { type?: unknown; data?: { status?: unknown } };
  if (rec.type !== ZIINA_PAYMENT_STATUS_EVENT) return null;

  const status = rec.data?.status;
  if (status === "COMPLETED" || status === "FAILED" || status === "CANCELED") {
    return status;
  }
  return null;
};
