import { and, desc, eq, lt } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { payment, paymentEvent, platformSetting } from "@/lib/db/schema";
import { ZIINA_WIDGET_OPENED_EVENT_TYPE } from "@/lib/payments/ziina-checkout-session";
import { getZiinaWebhook, getZiinaPaymentIntent } from "@/lib/payments/ziina-client";
import { ZIINA_WEBHOOK_EVENT_TYPE } from "@/lib/payments/ziina-webhook-record";
import {
  expectedZiinaWebhookUrl,
  hostFromWebhookUrl,
  parseZiinaWebhookRegistrationRecord,
  PLATFORM_KEY_ZIINA_WEBHOOK_LAST_REGISTRATION,
  ziinaWebhookUrlMatchesExpected,
} from "@/lib/payments/ziina-webhook-url";
import { getZiinaServerConfig } from "@/lib/payments/resolve-payment-provider";

export const ZIINA_WEBHOOK_MISS_GRACE_MS = 2 * 60 * 1000;
export const ZIINA_WEBHOOK_MISS_STREAK = 3;
export const ZIINA_COMPLETED_UNPAID_AFTER_MS = 15 * 60 * 1000;

export type TPaymentsHealthAlertId =
  | "webhook_url_mismatch"
  | "webhook_silence"
  | "completed_unpaid";

export type TPaymentsHealthAlert = {
  id: TPaymentsHealthAlertId;
  message: string;
};

export type TPaymentsHealthResult = {
  ok: boolean;
  alerts: TPaymentsHealthAlert[];
  webhook: {
    expectedUrl: string;
    registeredUrl: string | null;
    registeredHost: string | null;
    lastLocalRegistrationHost: string | null;
    unreadable: boolean;
  };
};

export const consecutiveWebhookMissStreak = (missFlagsNewestFirst: boolean[]): number => {
  let streak = 0;
  for (const missed of missFlagsNewestFirst) {
    if (!missed) break;
    streak += 1;
  }
  return streak;
};

const loadLastLocalRegistrationHost = async (tx: DbTransaction): Promise<string | null> => {
  const [row] = await tx
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, PLATFORM_KEY_ZIINA_WEBHOOK_LAST_REGISTRATION))
    .limit(1);
  return parseZiinaWebhookRegistrationRecord(row?.value)?.host ?? null;
};

const loadWebhookSilenceCandidates = async (
  tx: DbTransaction,
  nowMs: number,
): Promise<Array<{ id: string; missed: boolean }>> => {
  const cutoff = new Date(nowMs - ZIINA_WEBHOOK_MISS_GRACE_MS);
  const opened = await tx
    .select({
      paymentId: paymentEvent.paymentId,
      createdAt: payment.createdAt,
    })
    .from(paymentEvent)
    .innerJoin(payment, eq(payment.id, paymentEvent.paymentId))
    .where(
      and(
        eq(paymentEvent.type, ZIINA_WIDGET_OPENED_EVENT_TYPE),
        eq(payment.provider, "ziina"),
        eq(payment.status, "checkout_created"),
        lt(payment.createdAt, cutoff),
      ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(20);

  const results: Array<{ id: string; missed: boolean }> = [];
  for (const row of opened) {
    if (!row.paymentId) continue;
    const [webhook] = await tx
      .select({ id: paymentEvent.id })
      .from(paymentEvent)
      .where(
        and(eq(paymentEvent.paymentId, row.paymentId), eq(paymentEvent.type, ZIINA_WEBHOOK_EVENT_TYPE)),
      )
      .limit(1);
    results.push({ id: row.paymentId, missed: !webhook });
  }
  return results;
};

const loadCompletedUnpaidAfterProbe = async (
  tx: DbTransaction,
  nowMs: number,
): Promise<Array<{ id: string; intentId: string }>> => {
  const cutoff = new Date(nowMs - ZIINA_COMPLETED_UNPAID_AFTER_MS);
  const rows = await tx
    .select({
      id: payment.id,
      intentId: payment.providerCheckoutId,
    })
    .from(payment)
    .innerJoin(paymentEvent, eq(paymentEvent.paymentId, payment.id))
    .where(
      and(
        eq(payment.provider, "ziina"),
        eq(payment.status, "checkout_created"),
        eq(paymentEvent.type, "ziina.reconcile.probe.15m"),
        lt(payment.createdAt, cutoff),
      ),
    )
    .limit(10);
  return rows
    .map((row) => ({ id: row.id, intentId: row.intentId?.trim() ?? "" }))
    .filter((row) => row.intentId);
};

export const collectPaymentsHealth = async (
  tx: DbTransaction,
  nowMs: number = Date.now(),
): Promise<TPaymentsHealthResult> => {
  const expectedUrl = expectedZiinaWebhookUrl();
  const lastLocalRegistrationHost = await loadLastLocalRegistrationHost(tx);
  const alerts: TPaymentsHealthAlert[] = [];

  let registeredUrl: string | null = null;
  let unreadable = true;
  try {
    const cfg = getZiinaServerConfig();
    const got = await getZiinaWebhook({
      baseUrl: cfg.apiBaseUrl,
      accessToken: cfg.accessToken,
      timeoutMs: 8000,
    });
    registeredUrl = got.url;
    unreadable = got.unreadable;
  } catch {
    unreadable = true;
  }

  const registeredHost = hostFromWebhookUrl(registeredUrl);
  if (registeredUrl && !ziinaWebhookUrlMatchesExpected(registeredUrl, expectedUrl)) {
    alerts.push({
      id: "webhook_url_mismatch",
      message: `webhook registered to ${registeredHost ?? registeredUrl}, not prod`,
    });
  }

  const silence = await loadWebhookSilenceCandidates(tx, nowMs);
  const streak = consecutiveWebhookMissStreak(silence.map((row) => row.missed));
  if (streak >= ZIINA_WEBHOOK_MISS_STREAK) {
    const hostHint = registeredHost ?? lastLocalRegistrationHost ?? "unknown host";
    alerts.push({
      id: "webhook_silence",
      message: unreadable
        ? `Ziina webhooks stopped arriving on prod (${streak} consecutive widget-opened intents with no webhook after 2m). Could not read Ziina's registered URL; last local registration host: ${hostHint}. If staging/prod share a Ziina token, check whether staging stole the webhook and re-register from prod admin.`
        : `Ziina webhooks stopped arriving on prod (${streak} consecutive widget-opened intents with no webhook after 2m). Webhook is registered to ${hostHint}.`,
    });
  }

  const unpaidCandidates = await loadCompletedUnpaidAfterProbe(tx, nowMs);
  let completedUnpaid = 0;
  try {
    const cfg = getZiinaServerConfig();
    for (const row of unpaidCandidates) {
      try {
        const intent = await getZiinaPaymentIntent({
          baseUrl: cfg.apiBaseUrl,
          accessToken: cfg.accessToken,
          paymentIntentId: row.intentId,
          timeoutMs: 8000,
        });
        if (intent.status === "completed") completedUnpaid += 1;
      } catch {
        /* skip this row; silence/url alerts still apply */
      }
    }
  } catch {
    /* Ziina not configured */
  }
  if (completedUnpaid > 0) {
    alerts.push({
      id: "completed_unpaid",
      message: `Ziina shows completed but local payment is still checkout_created after return and the 15-minute probe (${completedUnpaid} row(s)).`,
    });
  }

  return {
    ok: alerts.length === 0,
    alerts,
    webhook: {
      expectedUrl,
      registeredUrl,
      registeredHost,
      lastLocalRegistrationHost,
      unreadable,
    },
  };
};
