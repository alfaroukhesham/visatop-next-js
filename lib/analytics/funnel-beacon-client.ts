import { apiHref } from "@/lib/app-href";
import { isAnalyticsExcludedPath } from "@/lib/analytics/excluded-paths";
import { isPersistableFunnelEvent } from "@/lib/analytics/funnel-event-names";

const COOKIE = "vt_sid";

const randomId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sid_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

export const getOrCreateAnalyticsSessionId = (): string => {
  if (typeof document === "undefined") return randomId();
  const match = document.cookie.match(/(?:^|; )vt_sid=([^;]+)/);
  const existing = match?.[1] ? decodeURIComponent(match[1]) : "";
  if (existing.length >= 8) return existing;
  const id = randomId();
  const maxAge = 60 * 60 * 24 * 400;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  return id;
};

export type TFunnelBeaconParams = {
  applicationId?: string | number | boolean | null;
  nationalityCode?: string | number | boolean | null;
  serviceId?: string | number | boolean | null;
  errorCode?: string | number | boolean | null;
  httpStatus?: string | number | boolean | null;
  reason?: string | number | boolean | null;
};

const asOptionalString = (value: string | number | boolean | null | undefined): string | undefined => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
};

/** Fire-and-forget first-party funnel ingest. Never throws. */
export const sendFunnelBeacon = (
  eventName: string,
  params?: TFunnelBeaconParams,
): void => {
  if (typeof window === "undefined") return;
  if (isAnalyticsExcludedPath(window.location.pathname)) return;
  if (!isPersistableFunnelEvent(eventName)) return;
  const eventId = randomId();
  const sessionId = getOrCreateAnalyticsSessionId();
  const httpStatus =
    typeof params?.httpStatus === "number" &&
    Number.isInteger(params.httpStatus) &&
    params.httpStatus >= 100 &&
    params.httpStatus <= 599
      ? params.httpStatus
      : undefined;
  const body = {
    eventId,
    eventName,
    sessionId,
    applicationId: asOptionalString(params?.applicationId),
    nationalityCode: asOptionalString(params?.nationalityCode),
    serviceId: asOptionalString(params?.serviceId),
    errorCode: asOptionalString(params?.errorCode),
    httpStatus,
    reason: asOptionalString(params?.reason),
  };
  try {
    void fetch(apiHref("analytics/events"), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(body),
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
};
