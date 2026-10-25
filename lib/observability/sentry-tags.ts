import { getActivePaymentProvider } from "@/lib/payments/resolve-payment-provider";
import type { TSentryEventLike } from "./sentry-scrub";

const APPLY_APPLICATION_PATH_RE = /(?:^|\/)apply\/applications\/([^/?#]+)/i;

export const extractApplicationIdFromPath = (path: string | undefined): string | undefined => {
  if (!path) return undefined;
  const match = APPLY_APPLICATION_PATH_RE.exec(path);
  const id = match?.[1]?.trim();
  return id || undefined;
};

export const resolvePaymentProviderTag = (): string => {
  const fromPublic = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER?.trim().toLowerCase();
  if (fromPublic === "ziina" || fromPublic === "paddle" || fromPublic === "fincra") {
    return fromPublic;
  }
  return getActivePaymentProvider();
};

const requestPath = (event: TSentryEventLike): string | undefined =>
  event.request?.url ?? (typeof event.transaction === "string" ? event.transaction : undefined);

export const applyObservabilityTags = <T extends TSentryEventLike>(event: T): T => {
  const tags = { ...(event.tags ?? {}) };
  if (!tags.applicationId) {
    const applicationId = extractApplicationIdFromPath(requestPath(event));
    if (applicationId) tags.applicationId = applicationId;
  }
  if (!tags.payment_provider) {
    tags.payment_provider = resolvePaymentProviderTag();
  }
  event.tags = tags;
  return event;
};
