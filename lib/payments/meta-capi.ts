import { createHash } from "node:crypto";
import { after } from "next/server";
import { and, desc, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import { extractClientIp } from "@/lib/applications/client-ip";
import { withSystemDbActor } from "@/lib/db/actor-context";
import type { DbTransaction } from "@/lib/db";
import { application, payment } from "@/lib/db/schema";
import { resolveApplicantEmailTx } from "@/lib/email/resolve-applicant-email";
import { createRequestLogger } from "@/lib/logger";

/** Pinned Graph API version for Meta Conversions API. */
export const META_CAPI_GRAPH_API_VERSION = "v21.0";

/** WebisteVisa pixel — same id the browser Purchase uses for event_id dedupe. */
export const META_CAPI_DEFAULT_PIXEL_ID = "1098702859698634";

const META_CAPI_TIMEOUT_MS = 4000;
const META_CAPI_RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const META_CAPI_RETRY_PROVIDERS = ["ziina", "fincra"] as const;

export type TMetaCapiAttribution = {
  fbp: string | null;
  fbc: string | null;
  clientIp: string | null;
  clientUserAgent: string | null;
  eventSourceUrl: string | null;
};

export type TMetaCapiPurchaseInput = {
  applicationId: string;
  amountMinor: bigint;
  currency: string;
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
  nationalityCode?: string | null;
  attribution: TMetaCapiAttribution;
  eventTimeUnix?: number;
};

export type TMetaCapiSendContext = TMetaCapiPurchaseInput & {
  paymentApplicationId: string | null;
  paymentStatus: string;
};

export type TMetaCapiSendResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "missing_token"
        | "already_sent"
        | "not_paying_application"
        | "not_found"
        | "graph_error";
    };

export type TMetaCapiLog = {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
};

export type TMetaCapiSendDeps = {
  env?: NodeJS.Dict<string>;
  loadContext: (applicationId: string) => Promise<TMetaCapiSendContext | null>;
  claim: (applicationId: string) => Promise<boolean>;
  release: (applicationId: string) => Promise<void>;
  fetchFn: typeof fetch;
  nowMs?: () => number;
  log?: TMetaCapiLog;
};

const asNonEmpty = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const hashMetaCapiField = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

export const normalizeMetaCapiEmail = (value: string): string | null => {
  const email = asNonEmpty(value)?.toLowerCase() ?? null;
  return email;
};

export const normalizeMetaCapiPhone = (value: string): string | null => {
  const digits = value.replace(/\D/g, "");
  return digits ? digits : null;
};

export const normalizeMetaCapiCountry = (value: string): string | null => {
  const code = asNonEmpty(value)?.toLowerCase() ?? null;
  if (!code || !/^[a-z]{2}$/.test(code)) return null;
  return code;
};

export const minorUnitsToMetaValue = (minor: bigint): number => Math.round(Number(minor)) / 100;

const readCookieValue = (cookieHeader: string | null, name: string): string | null => {
  if (!cookieHeader?.trim()) return null;
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const pair = part.trim();
    if (!pair.startsWith(prefix)) continue;
    const raw = pair.slice(prefix.length);
    try {
      return asNonEmpty(decodeURIComponent(raw));
    } catch {
      return asNonEmpty(raw);
    }
  }
  return null;
};

const fbclidFromUrl = (rawUrl: string | null): string | null => {
  if (!rawUrl) return null;
  try {
    return asNonEmpty(new URL(rawUrl).searchParams.get("fbclid"));
  } catch {
    return null;
  }
};

export const buildMetaFbc = (params: {
  fbcCookie?: string | null;
  fbclid?: string | null;
  nowMs?: number;
}): string | null => {
  const cookie = asNonEmpty(params.fbcCookie);
  if (cookie) return cookie;
  const fbclid = asNonEmpty(params.fbclid);
  if (!fbclid) return null;
  const nowMs = params.nowMs ?? Date.now();
  return `fb.1.${nowMs}.${fbclid}`;
};

export const readMetaCapiAttribution = (
  headers: Headers,
  nowMs: number = Date.now(),
): TMetaCapiAttribution => {
  const cookieHeader = headers.get("cookie");
  const eventSourceUrl =
    asNonEmpty(headers.get("referer")) ?? asNonEmpty(headers.get("referrer"));
  const fbc = buildMetaFbc({
    fbcCookie: readCookieValue(cookieHeader, "_fbc"),
    fbclid: fbclidFromUrl(eventSourceUrl),
    nowMs,
  });
  const ip = extractClientIp(headers);
  return {
    fbp: readCookieValue(cookieHeader, "_fbp"),
    fbc,
    clientIp: ip === "unknown" ? null : ip,
    clientUserAgent: asNonEmpty(headers.get("user-agent")),
    eventSourceUrl,
  };
};

const hashedList = (normalized: string | null): string[] | undefined =>
  normalized ? [hashMetaCapiField(normalized)] : undefined;

export const buildMetaCapiPurchaseEvent = (
  input: TMetaCapiPurchaseInput,
): Record<string, unknown> => {
  const userData: Record<string, unknown> = {};
  const em = hashedList(input.email ? normalizeMetaCapiEmail(input.email) : null);
  const ph = hashedList(input.phone ? normalizeMetaCapiPhone(input.phone) : null);
  const externalId = hashedList(asNonEmpty(input.userId ?? null));
  const country = hashedList(
    input.nationalityCode ? normalizeMetaCapiCountry(input.nationalityCode) : null,
  );
  if (em) userData.em = em;
  if (ph) userData.ph = ph;
  if (externalId) userData.external_id = externalId;
  if (country) userData.country = country;
  const ip = asNonEmpty(input.attribution.clientIp);
  if (ip && ip !== "unknown") userData.client_ip_address = ip;
  const ua = asNonEmpty(input.attribution.clientUserAgent);
  if (ua) userData.client_user_agent = ua;
  const fbp = asNonEmpty(input.attribution.fbp);
  if (fbp) userData.fbp = fbp;
  const fbc = asNonEmpty(input.attribution.fbc);
  if (fbc) userData.fbc = fbc;

  const event: Record<string, unknown> = {
    event_name: "Purchase",
    event_time: input.eventTimeUnix ?? Math.floor(Date.now() / 1000),
    event_id: input.applicationId,
    action_source: "website",
    user_data: userData,
    custom_data: {
      value: minorUnitsToMetaValue(input.amountMinor),
      currency: input.currency.trim().toUpperCase(),
    },
  };
  const sourceUrl = asNonEmpty(input.attribution.eventSourceUrl);
  if (sourceUrl) event.event_source_url = sourceUrl;
  return event;
};

export const shouldSendMetaCapiPurchaseForApplication = (params: {
  applicationId: string;
  paymentApplicationId: string | null;
  paymentStatus: string;
}): boolean =>
  params.paymentStatus === "paid" &&
  params.paymentApplicationId !== null &&
  params.paymentApplicationId === params.applicationId;

export const isRetryableMetaCapiPurchase = (row: {
  paymentStatus: string;
  capiPurchaseSentAt: Date | null;
  paidAt: Date | null;
  paymentProvider: string;
  isPaymentOwner: boolean;
  now: Date;
}): boolean => {
  if (row.paymentStatus !== "paid") return false;
  if (row.capiPurchaseSentAt) return false;
  if (!row.isPaymentOwner) return false;
  if (row.paymentProvider === "paddle") return false;
  if (!row.paidAt) return false;
  return row.now.getTime() - row.paidAt.getTime() <= META_CAPI_RETRY_WINDOW_MS;
};

export const getMetaCapiConfig = (
  env: NodeJS.Dict<string> = process.env,
): { token: string | null; pixelId: string; testEventCode: string | null } => ({
  token: asNonEmpty(env.META_CAPI_TOKEN),
  pixelId: asNonEmpty(env.META_PIXEL_ID_CAPI) ?? META_CAPI_DEFAULT_PIXEL_ID,
  testEventCode: asNonEmpty(env.META_TEST_EVENT_CODE),
});

const graphEventsUrl = (pixelId: string): string =>
  `https://graph.facebook.com/${META_CAPI_GRAPH_API_VERSION}/${encodeURIComponent(pixelId)}/events`;

const postMetaCapiPurchase = async (
  params: {
    token: string;
    pixelId: string;
    testEventCode: string | null;
    event: Record<string, unknown>;
    fetchFn: typeof fetch;
  },
): Promise<{ ok: true } | { ok: false; status: number }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), META_CAPI_TIMEOUT_MS);
  try {
    const body: Record<string, unknown> = {
      access_token: params.token,
      data: [params.event],
    };
    if (params.testEventCode) body.test_event_code = params.testEventCode;
    const res = await params.fetchFn(graphEventsUrl(params.pixelId), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let json: unknown = null;
    try {
      json = JSON.parse(await res.text());
    } catch {
      json = null;
    }
    const record = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
    const eventsReceived = typeof record?.events_received === "number" ? record.events_received : 0;
    if (!res.ok || record?.error || eventsReceived < 1) {
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } finally {
    clearTimeout(timer);
  }
};

export const sendMetaCapiPurchaseEvent = async (
  applicationId: string,
  deps: TMetaCapiSendDeps,
): Promise<TMetaCapiSendResult> => {
  const log = deps.log ?? createRequestLogger();
  const config = getMetaCapiConfig(deps.env ?? process.env);
  if (!config.token) {
    log.info({ applicationId }, "[meta-capi] META_CAPI_TOKEN is not set; skipping Purchase");
    return { ok: false, reason: "missing_token" };
  }

  const context = await deps.loadContext(applicationId);
  if (!context) return { ok: false, reason: "not_found" };
  if (
    !shouldSendMetaCapiPurchaseForApplication({
      applicationId,
      paymentApplicationId: context.paymentApplicationId,
      paymentStatus: context.paymentStatus,
    })
  ) {
    return { ok: false, reason: "not_paying_application" };
  }

  const claimed = await deps.claim(applicationId);
  if (!claimed) return { ok: false, reason: "already_sent" };

  try {
    const posted = await postMetaCapiPurchase({
      token: config.token,
      pixelId: config.pixelId,
      testEventCode: config.testEventCode,
      event: buildMetaCapiPurchaseEvent({
        ...context,
        applicationId,
      }),
      fetchFn: deps.fetchFn,
    });
    if (!posted.ok) {
      await deps.release(applicationId);
      log.error(
        { applicationId, status: posted.status },
        "[meta-capi] Graph API Purchase failed",
      );
      return { ok: false, reason: "graph_error" };
    }
    return { ok: true };
  } catch (err) {
    await deps.release(applicationId);
    log.error({ err, applicationId }, "[meta-capi] Graph API Purchase request failed");
    return { ok: false, reason: "graph_error" };
  }
};

export const persistMetaCapiAttribution = async (
  tx: DbTransaction,
  applicationId: string,
  attribution: TMetaCapiAttribution,
): Promise<void> => {
  const patch: {
    metaFbp?: string;
    metaFbc?: string;
    metaClientIp?: string;
    metaClientUserAgent?: string;
    metaEventSourceUrl?: string;
  } = {};
  if (attribution.fbp) patch.metaFbp = attribution.fbp;
  if (attribution.fbc) patch.metaFbc = attribution.fbc;
  if (attribution.clientIp) patch.metaClientIp = attribution.clientIp;
  if (attribution.clientUserAgent) patch.metaClientUserAgent = attribution.clientUserAgent;
  if (attribution.eventSourceUrl) patch.metaEventSourceUrl = attribution.eventSourceUrl;
  if (Object.keys(patch).length === 0) return;
  await tx.update(application).set(patch).where(eq(application.id, applicationId));
};

export const claimMetaCapiPurchaseSend = async (
  tx: DbTransaction,
  applicationId: string,
): Promise<boolean> => {
  const rows = await tx
    .update(application)
    .set({ capiPurchaseSentAt: new Date() })
    .where(
      and(
        eq(application.id, applicationId),
        isNull(application.capiPurchaseSentAt),
        eq(application.paymentStatus, "paid"),
      ),
    )
    .returning({ id: application.id });
  return rows.length > 0;
};

export const releaseMetaCapiPurchaseSend = async (
  tx: DbTransaction,
  applicationId: string,
): Promise<void> => {
  await tx
    .update(application)
    .set({ capiPurchaseSentAt: null })
    .where(eq(application.id, applicationId));
};

export const loadMetaCapiSendContext = async (
  tx: DbTransaction,
  applicationId: string,
): Promise<TMetaCapiSendContext | null> => {
  const [app] = await tx
    .select()
    .from(application)
    .where(eq(application.id, applicationId))
    .limit(1);
  if (!app) return null;

  const [pay] = await tx
    .select()
    .from(payment)
    .where(and(eq(payment.applicationId, applicationId), eq(payment.status, "paid")))
    .orderBy(desc(payment.createdAt))
    .limit(1);

  const email = await resolveApplicantEmailTx(tx, app);
  const paidAt = app.paidAt instanceof Date ? app.paidAt : app.paidAt ? new Date(app.paidAt) : null;
  return {
    applicationId: app.id,
    paymentApplicationId: pay?.applicationId ?? null,
    paymentStatus: app.paymentStatus,
    amountMinor: pay?.amount ?? BigInt(0),
    currency: pay?.currency ?? "USD",
    email,
    phone: app.phone,
    userId: app.userId,
    nationalityCode: app.nationalityCode,
    attribution: {
      fbp: app.metaFbp,
      fbc: app.metaFbc,
      clientIp: app.metaClientIp,
      clientUserAgent: app.metaClientUserAgent,
      eventSourceUrl: app.metaEventSourceUrl,
    },
    eventTimeUnix: paidAt ? Math.floor(paidAt.getTime() / 1000) : Math.floor(Date.now() / 1000),
  };
};

export const listUnsentPaidCapiPurchaseIds = async (
  tx: DbTransaction,
  now: Date = new Date(),
): Promise<string[]> => {
  const cutoff = new Date(now.getTime() - META_CAPI_RETRY_WINDOW_MS);
  const rows = await tx
    .select({ id: application.id })
    .from(application)
    .innerJoin(
      payment,
      and(
        eq(payment.applicationId, application.id),
        eq(payment.status, "paid"),
        inArray(payment.provider, [...META_CAPI_RETRY_PROVIDERS]),
      ),
    )
    .where(
      and(
        eq(application.paymentStatus, "paid"),
        isNull(application.capiPurchaseSentAt),
        isNotNull(application.paidAt),
        gte(application.paidAt, cutoff),
      ),
    );
  return [...new Set(rows.map((row) => row.id))];
};

export const sendMetaCapiPurchase = async (
  applicationId: string,
  requestId?: string | null,
): Promise<TMetaCapiSendResult> => {
  const log = createRequestLogger(requestId);
  return sendMetaCapiPurchaseEvent(applicationId, {
    env: process.env,
    fetchFn: fetch,
    log,
    loadContext: (id) => withSystemDbActor((tx) => loadMetaCapiSendContext(tx, id)),
    claim: (id) => withSystemDbActor((tx) => claimMetaCapiPurchaseSend(tx, id)),
    release: async (id) => {
      await withSystemDbActor((tx) => releaseMetaCapiPurchaseSend(tx, id));
    },
  });
};

export const scheduleMetaCapiPurchase = (
  applicationId: string,
  requestId?: string | null,
): void => {
  after(() => {
    void sendMetaCapiPurchase(applicationId, requestId).catch((err: unknown) => {
      createRequestLogger(requestId).error(
        { err, applicationId },
        "[meta-capi] Purchase send failed",
      );
    });
  });
};
