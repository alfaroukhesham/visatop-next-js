import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { GUEST_LINK_EVENTS } from "@/lib/analytics/guest-link-events";
import {
  DOCUMENT_UPLOAD_CANCELLED,
  DOCUMENT_UPLOAD_FAILED,
} from "@/lib/analytics/upload-funnel-event";

export const FUNNEL_CHECKOUT_CREATED = "checkout_created";

const APPLY_PERSISTABLE = Object.values(APPLY_FUNNEL_EVENTS).filter(
  (name) => name !== APPLY_FUNNEL_EVENTS.purchase,
);

const PERSISTABLE = new Set<string>([
  ...APPLY_PERSISTABLE,
  FUNNEL_CHECKOUT_CREATED,
  DOCUMENT_UPLOAD_FAILED,
  DOCUMENT_UPLOAD_CANCELLED,
  ...Object.values(GUEST_LINK_EVENTS),
]);

export const isPersistableFunnelEvent = (eventName: string): boolean =>
  PERSISTABLE.has(eventName);

/** Chooser fires visa_selected before an application exists; server create is canonical. */
export const shouldSkipClientFunnelPersist = (eventName: string): boolean =>
  eventName === APPLY_FUNNEL_EVENTS.visaSelected;

export const serverFunnelEventId = (applicationId: string, eventName: string): string =>
  `server:${applicationId}:${eventName}`;

const SESSION_ID_RE = /^[A-Za-z0-9:_-]{8,80}$/;
const EVENT_ID_RE = /^[A-Za-z0-9:_-]{8,80}$/;
const OPTIONAL_ID_RE = /^[A-Za-z0-9:_-]{1,80}$/;

export type TBeaconPayload = {
  eventId: string;
  eventName: string;
  sessionId: string;
  applicationId?: string | null;
  nationalityCode?: string | null;
  serviceId?: string | null;
};

export type TParseBeaconResult =
  | { ok: true; data: TBeaconPayload }
  | { ok: false; message: string };

const FORBIDDEN_KEYS = new Set([
  "email",
  "guestEmail",
  "fullName",
  "passport",
  "passportNumber",
  "phone",
  "address",
]);

export const parseBeaconPayload = (raw: unknown): TParseBeaconResult => {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, message: "Invalid body" };
  }
  const rec = raw as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return { ok: false, message: "PII fields are not allowed" };
    }
  }
  const eventId = typeof rec.eventId === "string" ? rec.eventId.trim() : "";
  const eventName = typeof rec.eventName === "string" ? rec.eventName.trim() : "";
  const sessionId = typeof rec.sessionId === "string" ? rec.sessionId.trim() : "";
  if (!EVENT_ID_RE.test(eventId) || !SESSION_ID_RE.test(sessionId)) {
    return { ok: false, message: "Invalid eventId or sessionId" };
  }
  if (!isPersistableFunnelEvent(eventName)) {
    return { ok: false, message: "Unknown event name" };
  }
  const applicationId =
    typeof rec.applicationId === "string" && rec.applicationId.trim()
      ? rec.applicationId.trim()
      : null;
  const nationalityCode =
    typeof rec.nationalityCode === "string" && rec.nationalityCode.trim()
      ? rec.nationalityCode.trim().toUpperCase()
      : null;
  const serviceId =
    typeof rec.serviceId === "string" && rec.serviceId.trim() ? rec.serviceId.trim() : null;
  if (applicationId && !OPTIONAL_ID_RE.test(applicationId)) {
    return { ok: false, message: "Invalid applicationId" };
  }
  if (nationalityCode && !/^[A-Z]{2}$/.test(nationalityCode)) {
    return { ok: false, message: "Invalid nationalityCode" };
  }
  if (serviceId && !OPTIONAL_ID_RE.test(serviceId)) {
    return { ok: false, message: "Invalid serviceId" };
  }
  return {
    ok: true,
    data: {
      eventId,
      eventName,
      sessionId,
      applicationId,
      nationalityCode,
      serviceId,
    },
  };
};
