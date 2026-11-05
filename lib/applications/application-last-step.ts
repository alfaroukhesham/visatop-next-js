/**
 * Shared last-step / drop-off resolver.
 *
 * Analytics unpaid "stops" and the admin application summary card both call
 * `resolveAnalyticsStopScreen` (wizard cursor → `abandonStopFromCursor`).
 * Checkout / paid / declined use `resolveAdminListPaymentStatus`.
 * Funnel CSV `last_step` uses `furthestAdminFunnelStep` (linear events only).
 *
 * Per-application precision (passport vs photo, details vs review) is derived
 * from existing upload / profile rows — no new event table or migration.
 * Gap: there is no dedicated "entered this screen at" timestamp; we use
 * party.updatedAt, document.createdAt, payment times, or event.occurredAt.
 * Pre-application trip/nationality drop-off has no application details row.
 */
import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { FUNNEL_CHECKOUT_CREATED } from "@/lib/analytics/funnel-event-names";
import { ADMIN_FUNNEL_STEPS } from "@/lib/analytics/funnel-metrics";
import { DOCUMENT_STATUS, DOCUMENT_TYPE } from "@/lib/apply/document-type-constants";
import {
  abandonStopFromCursor,
  APPLY_WIZARD_SCREENS,
  type TApplyStopScreen,
  type TApplyWizardScreen,
} from "@/lib/apply/apply-wizard";
import {
  ADMIN_LIST_SETTLED_PAYMENT_STATUSES,
  resolveAdminListPaymentStatus,
} from "@/lib/applications/admin-list-status";

/** Unpaid-stop buckets shared with Admin → Analytics. */
export const APPLY_STOP_SCREENS = ["ready", "passport", "other", "details", "pay"] as const;

export const APPLY_STOP_LABELS: Record<(typeof APPLY_STOP_SCREENS)[number], string> = {
  ready: "What you'll need",
  passport: "Passport",
  other: "Other documents",
  details: "Check your details",
  pay: "Payment",
};

export type TApplicationLastStepId =
  | "trip_nationality"
  | "service_selection"
  | "docs_ready"
  | "passport_upload"
  | "photo_upload"
  | "supporting_documents"
  | "traveller_details"
  | "review"
  | "payment"
  | "checkout_started"
  | "payment_failed"
  | "paid";

export const APPLICATION_LAST_STEP_LABELS: Record<TApplicationLastStepId, string> = {
  trip_nationality: "Nationality / start",
  service_selection: "Visa selected / created",
  docs_ready: APPLY_STOP_LABELS.ready,
  passport_upload: "Passport upload",
  photo_upload: "Photo upload",
  supporting_documents: "Supporting documents",
  traveller_details: "Traveller details",
  review: APPLY_STOP_LABELS.details,
  payment: APPLY_STOP_LABELS.pay,
  checkout_started: "Checkout started",
  payment_failed: "Payment failed",
  paid: "Paid",
};

const FUNNEL_STEP_ALIASES: Record<string, string> = {
  [APPLY_FUNNEL_EVENTS.passportUploaded]: APPLY_FUNNEL_EVENTS.passportUploadSucceeded,
};

const FUNNEL_EVENT_TO_STEP_ID: Record<string, TApplicationLastStepId> = {
  [APPLY_FUNNEL_EVENTS.applicationStarted]: "trip_nationality",
  [APPLY_FUNNEL_EVENTS.eligibilityCompleted]: "service_selection",
  [APPLY_FUNNEL_EVENTS.visaListViewed]: "service_selection",
  [APPLY_FUNNEL_EVENTS.visaSelected]: "service_selection",
  [APPLY_FUNNEL_EVENTS.applicationLinkSaved]: "service_selection",
  [APPLY_FUNNEL_EVENTS.docsReadyViewed]: "docs_ready",
  [APPLY_FUNNEL_EVENTS.passportUploadSucceeded]: "passport_upload",
  [APPLY_FUNNEL_EVENTS.passportUploaded]: "passport_upload",
  [APPLY_FUNNEL_EVENTS.detailsReviewViewed]: "review",
  [APPLY_FUNNEL_EVENTS.checkoutViewed]: "payment",
  [APPLY_FUNNEL_EVENTS.paymentStarted]: "payment",
  [APPLY_FUNNEL_EVENTS.paymentSucceeded]: "paid",
  [FUNNEL_CHECKOUT_CREATED]: "checkout_started",
};

/** Linear (+ alias) names needed when no wizard cursor decides the step. */
export const LAST_STEP_FUNNEL_EVENT_NAMES: readonly string[] = [
  ...new Set([...Object.keys(FUNNEL_EVENT_TO_STEP_ID), ...Object.keys(FUNNEL_STEP_ALIASES)]),
];

const ADMIN_DOC_TYPES = new Set<string>([
  DOCUMENT_TYPE.ADMIN_STEP_ATTACHMENT,
  DOCUMENT_TYPE.OUTCOME_APPROVAL,
  DOCUMENT_TYPE.OUTCOME_AUTHORITY_REJECTION,
]);

export type TFurthestAdminFunnelStep = {
  eventName: string;
  label: string;
  index: number;
};

export const furthestAdminFunnelStep = (
  eventNames: string[],
): TFurthestAdminFunnelStep | null => {
  let furthest = -1;
  for (const name of eventNames) {
    const canonical = FUNNEL_STEP_ALIASES[name] ?? name;
    const idx = ADMIN_FUNNEL_STEPS.findIndex((step) => step.eventName === canonical);
    if (idx > furthest) furthest = idx;
  }
  if (furthest < 0) return null;
  const step = ADMIN_FUNNEL_STEPS[furthest]!;
  return { eventName: step.eventName, label: step.label, index: furthest };
};

const isApplyWizardScreen = (value: string | null | undefined): value is TApplyWizardScreen =>
  Boolean(value && (APPLY_WIZARD_SCREENS as readonly string[]).includes(value));

/** Screen an unpaid application is sitting on — same helper Analytics stops use. */
export const resolveAnalyticsStopScreen = (input: {
  cursorScreen: string | null;
  cursorTravellerId: string | null;
  lastTravellerId: string | null;
}): TApplyStopScreen => {
  const cursor = isApplyWizardScreen(input.cursorScreen)
    ? { screen: input.cursorScreen, travellerId: input.cursorTravellerId }
    : null;
  return abandonStopFromCursor({
    cursor,
    lastTravellerId: input.lastTravellerId,
  });
};

export type TLastStepDocument = {
  applicationId?: string;
  documentType: string | null;
  status: string | null;
  createdAt: Date;
};

export type TLastStepTraveller = {
  applicationId: string;
  travelerIndex: number;
  profileStarted: boolean;
};

export type TLastStepPayment = {
  status: string;
  failureCode?: string | null;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TLastStepEvent = {
  eventName: string;
  occurredAt?: Date;
};

export type TApplicationLastStepInput = {
  applicationPaymentStatus: string;
  applicationCreatedAt: Date;
  applicationUpdatedAt: Date;
  applicationPaidAt?: Date | null;
  latestPayment?: TLastStepPayment | null;
  /** `null` = known empty wizard cursor. Omit when the app has no party/cursor row. */
  wizardCursor?: { screen: string | null; travellerId: string | null } | null;
  lastTravellerId?: string | null;
  partyUpdatedAt?: Date | null;
  documents?: TLastStepDocument[];
  travellers?: TLastStepTraveller[];
  events?: TLastStepEvent[];
  /** Max funnel `occurred_at` when event rows are omitted (wizard cursor already decided the step). */
  lastEventAt?: Date | null;
  profileStarted?: boolean;
  now?: Date;
};

export type TApplicationLastStep = {
  id: TApplicationLastStepId;
  label: string;
  fieldLabel: "Last step reached" | "Stopped at";
  reachedAt: Date;
  lastActivityAt: Date;
  provider: string | null;
  travellerId: string | null;
  travellerIndex: number | null;
  displayValue: string;
  whenDisplay: string;
};

export type TAdminLastStepView = {
  fieldLabel: TApplicationLastStep["fieldLabel"] | string;
  value: string;
  secondary: string;
};

export const toAdminLastStepView = (step: TApplicationLastStep): TAdminLastStepView => ({
  fieldLabel: step.fieldLabel,
  value: step.displayValue,
  secondary: step.whenDisplay,
});

const isSettled = (status: string): boolean =>
  (ADMIN_LIST_SETTLED_PAYMENT_STATUSES as readonly string[]).includes(status);

const titleCaseProvider = (provider: string): string =>
  provider
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

export const formatAdminRelativeTime = (date: Date, now: Date): string => {
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
};

/** Relative phrase plus the same absolute string the Created row uses (`toLocaleString()`). */
export const formatAdminWhen = (date: Date, now: Date): string =>
  `${formatAdminRelativeTime(date, now)} · ${date.toLocaleString()}`;

export const isApplicantProfileStarted = (profile: {
  fullName?: string | null;
  dateOfBirth?: string | Date | null;
  passportNumber?: string | null;
}): boolean => {
  if (profile.fullName?.trim()) return true;
  if (profile.passportNumber?.trim()) return true;
  if (profile.dateOfBirth instanceof Date) return !Number.isNaN(profile.dateOfBirth.getTime());
  if (typeof profile.dateOfBirth === "string") return Boolean(profile.dateOfBirth.trim());
  return false;
};

const maxDate = (dates: Array<Date | null | undefined>): Date | null => {
  let best: Date | null = null;
  for (const date of dates) {
    if (!date) continue;
    if (!best || date.getTime() > best.getTime()) best = date;
  }
  return best;
};

const isPresentCustomerDocument = (doc: TLastStepDocument): boolean => {
  const type = doc.documentType?.trim() ?? "";
  if (!type || ADMIN_DOC_TYPES.has(type)) return false;
  return doc.status !== DOCUMENT_STATUS.DELETED;
};

const docsForTraveller = (
  documents: TLastStepDocument[],
  travellerId: string | null,
): TLastStepDocument[] => {
  const present = documents.filter(isPresentCustomerDocument);
  if (!travellerId) return present;
  const scoped = present.filter((doc) => !doc.applicationId || doc.applicationId === travellerId);
  return scoped;
};

const hasDocType = (documents: TLastStepDocument[], type: string): boolean =>
  documents.some((doc) => doc.documentType === type);

const latestDocAt = (documents: TLastStepDocument[], type: string): Date | null =>
  maxDate(documents.filter((doc) => doc.documentType === type).map((doc) => doc.createdAt));

const sortedTravellers = (travellers: TLastStepTraveller[]): TLastStepTraveller[] =>
  travellers.toSorted((a, b) => a.travelerIndex - b.travelerIndex);

const focusTravellerId = (input: {
  stop: TApplyStopScreen;
  cursor: { screen: TApplyWizardScreen; travellerId: string | null } | null;
  travellers: TLastStepTraveller[];
}): string | null => {
  const sorted = sortedTravellers(input.travellers);
  if (input.stop === "ready" || input.stop === "pay") return null;
  if (input.stop === "other" || input.stop === "details") {
    return input.cursor?.travellerId ?? sorted[0]?.applicationId ?? null;
  }
  if (!input.cursor || input.cursor.screen === "ready") {
    return sorted[0]?.applicationId ?? null;
  }
  if (input.cursor.screen === "details") {
    const idx = sorted.findIndex((row) => row.applicationId === input.cursor?.travellerId);
    return (idx >= 0 ? sorted[idx + 1] : null)?.applicationId ?? sorted[0]?.applicationId ?? null;
  }
  return input.cursor.travellerId ?? sorted[0]?.applicationId ?? null;
};

const refineStop = (input: {
  stop: TApplyStopScreen;
  documents: TLastStepDocument[];
  profileStarted: boolean;
}): { id: TApplicationLastStepId; reachedFromDocs: Date | null } => {
  if (input.stop === "ready") return { id: "docs_ready", reachedFromDocs: null };
  if (input.stop === "other") return { id: "supporting_documents", reachedFromDocs: null };
  if (input.stop === "details") {
    return {
      id: input.profileStarted ? "review" : "traveller_details",
      reachedFromDocs: null,
    };
  }
  if (input.stop === "pay") return { id: "payment", reachedFromDocs: null };

  const hasPassport = hasDocType(input.documents, DOCUMENT_TYPE.PASSPORT_COPY);
  const hasPhoto = hasDocType(input.documents, DOCUMENT_TYPE.PERSONAL_PHOTO);
  if (!hasPassport) return { id: "passport_upload", reachedFromDocs: null };
  if (!hasPhoto) {
    return {
      id: "photo_upload",
      reachedFromDocs: latestDocAt(input.documents, DOCUMENT_TYPE.PASSPORT_COPY),
    };
  }
  return {
    id: "photo_upload",
    reachedFromDocs: latestDocAt(input.documents, DOCUMENT_TYPE.PERSONAL_PHOTO),
  };
};

const stepFromFunnelEvent = (
  eventName: string,
): TApplicationLastStepId | null =>
  FUNNEL_EVENT_TO_STEP_ID[eventName] ?? FUNNEL_EVENT_TO_STEP_ID[FUNNEL_STEP_ALIASES[eventName] ?? ""] ?? null;

const displayValueFor = (input: {
  id: TApplicationLastStepId;
  label: string;
  provider: string | null;
  travellerIndex: number | null;
  travellerCount: number;
}): string => {
  const withProvider =
    (input.id === "checkout_started" || input.id === "payment_failed") && input.provider
      ? `${input.label} · ${titleCaseProvider(input.provider)}`
      : input.label;
  if (input.travellerCount > 1 && input.travellerIndex !== null) {
    return `${withProvider} · Traveller ${input.travellerIndex + 1}`;
  }
  return withProvider;
};

export const resolveApplicationLastStep = (
  input: TApplicationLastStepInput,
): TApplicationLastStep => {
  const now = input.now ?? new Date();
  const paymentStatus = resolveAdminListPaymentStatus({
    applicationPaymentStatus: input.applicationPaymentStatus,
    latestPaymentStatus: input.latestPayment?.status ?? null,
    latestPaymentFailureCode: input.latestPayment?.failureCode ?? null,
  });
  const settled = isSettled(input.applicationPaymentStatus) || paymentStatus === "paid";

  let id: TApplicationLastStepId = "service_selection";
  let reachedAt = input.applicationCreatedAt;
  const provider: string | null = input.latestPayment?.provider ?? null;
  let travellerId: string | null = null;

  if (settled || paymentStatus === "paid") {
    id = "paid";
    reachedAt =
      input.applicationPaidAt ??
      input.latestPayment?.updatedAt ??
      input.applicationUpdatedAt ??
      input.applicationCreatedAt;
  } else if (paymentStatus === "failed") {
    id = "payment_failed";
    reachedAt = input.latestPayment?.updatedAt ?? input.applicationUpdatedAt;
  } else if (paymentStatus === "checkout_created") {
    id = "checkout_started";
    reachedAt = input.latestPayment?.createdAt ?? input.applicationUpdatedAt;
  } else if (input.wizardCursor !== undefined) {
    const stop = resolveAnalyticsStopScreen({
      cursorScreen: input.wizardCursor?.screen ?? null,
      cursorTravellerId: input.wizardCursor?.travellerId ?? null,
      lastTravellerId: input.lastTravellerId ?? null,
    });
    const cursor = isApplyWizardScreen(input.wizardCursor?.screen ?? null)
      ? {
          screen: input.wizardCursor!.screen as TApplyWizardScreen,
          travellerId: input.wizardCursor!.travellerId,
        }
      : null;
    const travellers = input.travellers ?? [];
    travellerId = focusTravellerId({ stop, cursor, travellers });
    const docs = docsForTraveller(input.documents ?? [], travellerId);
    const focus = travellers.find((row) => row.applicationId === travellerId);
    const refined = refineStop({
      stop,
      documents: docs,
      profileStarted: focus?.profileStarted ?? input.profileStarted ?? false,
    });
    id = refined.id;
    reachedAt =
      refined.reachedFromDocs ??
      input.partyUpdatedAt ??
      input.applicationUpdatedAt ??
      input.applicationCreatedAt;
  } else {
    const eventNames = (input.events ?? []).map((event) => event.eventName);
    const furthest = furthestAdminFunnelStep(eventNames);
    if (furthest) {
      id = stepFromFunnelEvent(furthest.eventName) ?? "service_selection";
      const match = (input.events ?? [])
        .filter((event) => {
          const canonical = FUNNEL_STEP_ALIASES[event.eventName] ?? event.eventName;
          return canonical === furthest.eventName;
        })
        .map((event) => event.occurredAt);
      reachedAt = maxDate(match) ?? input.applicationCreatedAt;
    } else {
      id = "service_selection";
      reachedAt = input.applicationCreatedAt;
    }
  }

  const label = APPLICATION_LAST_STEP_LABELS[id];
  const travellers = input.travellers ?? [];
  const travellerIndex =
    travellerId === null
      ? null
      : (travellers.find((row) => row.applicationId === travellerId)?.travelerIndex ?? null);

  const lastActivityAt =
    maxDate([
      input.applicationCreatedAt,
      input.applicationUpdatedAt,
      input.applicationPaidAt,
      input.partyUpdatedAt,
      input.latestPayment?.createdAt,
      input.latestPayment?.updatedAt,
      input.lastEventAt,
      ...(input.documents ?? []).map((doc) => doc.createdAt),
      ...(input.events ?? []).map((event) => event.occurredAt),
      reachedAt,
    ]) ?? reachedAt;

  const when = formatAdminWhen(reachedAt, now);
  const whenDisplay =
    lastActivityAt.getTime() !== reachedAt.getTime()
      ? `${when}\nLast activity ${formatAdminWhen(lastActivityAt, now)}`
      : when;

  return {
    id,
    label,
    fieldLabel: settled ? "Last step reached" : "Stopped at",
    reachedAt,
    lastActivityAt,
    provider,
    travellerId,
    travellerIndex,
    displayValue: displayValueFor({
      id,
      label,
      provider,
      travellerIndex,
      travellerCount: travellers.length,
    }),
    whenDisplay,
  };
};
