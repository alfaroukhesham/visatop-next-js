import { and, desc, eq, exists, gte, inArray, isNotNull, lte, not, notInArray, or, sql } from "drizzle-orm";
import {
  checkoutCreatedAttemptExists,
  latestPaymentCreatedAtSql,
} from "@/lib/applications/admin-queries";
import { isAdminListCheckoutCreatedAttempt } from "@/lib/applications/admin-list-status";
import {
  isResumeEmailLinkSecretConfigured,
} from "@/lib/applications/resume-email-link";
import type { DbTransaction } from "@/lib/db";
import {
  application,
  applicationParty,
  payment,
  priceQuote,
  transactionalEmailSent,
  user,
  visaService,
} from "@/lib/db/schema";
import { CHECKOUT_RECOVERY_KIND, type TCheckoutRecoveryCandidate } from "./decide";

const SKIP_APPLICATION_STATUSES = [
  "cancelled",
  "completed",
  "rejection_by_uae_authorities",
  "in_progress",
  "awaiting_authority",
] as const;

export type TCheckoutRecoveryLoaded = {
  applicationId: string;
  partyId: string | null;
  isGuest: boolean;
  to: string;
  /** Cron has no persisted locale (no migration). Catalogs still have AR/FR copy. */
  locale: "en";
  fullName: string | null;
  visaName: string;
  reference: string;
  draftExpiresAt: Date | null;
  paymentProvider: string | null;
  amountMinor: bigint | null;
  currency: string | null;
  candidate: TCheckoutRecoveryCandidate;
};

export type TCheckoutRecoveryLoadParams = {
  now: Date;
  delayMs: number;
  maxAgeMs: number;
  limit: number;
};

const latestPaymentIsLatestSql = sql`${payment.id} = (
  select p2.id from payment p2
  where p2.application_id = ${application.id}
  order by p2.created_at desc
  limit 1
)`;

/** Still-open checkout (not reconciled failed/expired) whose createdAt is inside the delay/max-age window. */
const stillOpenCheckoutInWindowExists = (
  tx: DbTransaction,
  delayCutoff: Date,
  maxAgeCutoff: Date,
) =>
  exists(
    tx
      .select({ id: payment.id })
      .from(payment)
      .where(
        and(
          eq(payment.applicationId, application.id),
          latestPaymentIsLatestSql,
          eq(payment.status, "checkout_created"),
          lte(payment.createdAt, delayCutoff),
          gte(payment.createdAt, maxAgeCutoff),
        ),
      ),
  );

const recoveryCheckoutAlreadySentExists = (tx: DbTransaction) =>
  exists(
    tx
      .select({ id: transactionalEmailSent.id })
      .from(transactionalEmailSent)
      .where(
        and(
          eq(transactionalEmailSent.applicationId, application.id),
          eq(transactionalEmailSent.kind, CHECKOUT_RECOVERY_KIND),
        ),
      ),
  );

export const checkoutRecoveryCandidatesQuery = (
  tx: DbTransaction,
  params: TCheckoutRecoveryLoadParams,
) => {
  const delayCutoff = new Date(params.now.getTime() - params.delayMs);
  const maxAgeCutoff = new Date(params.now.getTime() - params.maxAgeMs);
  return tx
    .select({
      app: application,
      partyDraftExpiresAt: applicationParty.draftExpiresAt,
      serviceName: visaService.name,
      userEmail: user.email,
    })
    .from(application)
    .innerJoin(visaService, eq(application.serviceId, visaService.id))
    .leftJoin(applicationParty, eq(application.partyId, applicationParty.id))
    .leftJoin(user, eq(application.userId, user.id))
    .where(
      and(
        eq(application.travelerRole, "primary"),
        eq(application.paymentStatus, "checkout_created"),
        notInArray(application.applicationStatus, [...SKIP_APPLICATION_STATUSES]),
        or(isNotNull(application.guestEmail), isNotNull(application.userId)),
        checkoutCreatedAttemptExists(tx),
        stillOpenCheckoutInWindowExists(tx, delayCutoff, maxAgeCutoff),
        not(recoveryCheckoutAlreadySentExists(tx)),
      ),
    )
    .orderBy(sql`${latestPaymentCreatedAtSql} asc`)
    .limit(params.limit);
};

export const guestCheckoutResumeReady = (input: {
  isGuest: boolean;
  partyId: string | null;
  draftExpiresAt: Date | null;
  now: Date;
  secretConfigured?: boolean;
}): boolean => {
  if (!input.isGuest) return true;
  const secretOk = input.secretConfigured ?? isResumeEmailLinkSecretConfigured();
  if (!secretOk || !input.partyId || !input.draftExpiresAt) return false;
  return input.draftExpiresAt.getTime() > input.now.getTime();
};

/**
 * In-memory mirror of the SQL WHERE (drafts never occupy the batch).
 * Used by tests; the cron path filters in SQL via {@link checkoutRecoveryCandidatesQuery}.
 */
export const matchesCheckoutRecoverySqlCandidate = (row: {
  paymentStatus: string;
  latestPaymentStatus: string | null;
  checkoutCreatedAt: Date | null;
  alreadySent: boolean;
  now: Date;
  delayMs: number;
  maxAgeMs: number;
}): boolean => {
  if (row.alreadySent) return false;
  if (row.paymentStatus !== "checkout_created") return false;
  if (row.latestPaymentStatus !== "checkout_created") return false;
  if (!row.checkoutCreatedAt) return false;
  const ageMs = row.now.getTime() - row.checkoutCreatedAt.getTime();
  return ageMs >= row.delayMs && ageMs <= row.maxAgeMs;
};

export const loadCheckoutRecoveryCandidates = async (
  tx: DbTransaction,
  params: TCheckoutRecoveryLoadParams,
): Promise<TCheckoutRecoveryLoaded[]> => {
  const rows = await checkoutRecoveryCandidatesQuery(tx, params);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.app.id);
  const [paymentRows, quoteRows] = await Promise.all([
    tx
      .select({
        applicationId: payment.applicationId,
        status: payment.status,
        failureCode: payment.failureCode,
        provider: payment.provider,
        amount: payment.amount,
        currency: payment.currency,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .where(inArray(payment.applicationId, ids))
      .orderBy(desc(payment.createdAt)),
    tx
      .select({
        applicationId: priceQuote.applicationId,
        totalAmount: priceQuote.totalAmount,
        currency: priceQuote.currency,
      })
      .from(priceQuote)
      .where(inArray(priceQuote.applicationId, ids))
      .orderBy(desc(priceQuote.createdAt)),
  ]);

  const latestPayment = new Map<string, (typeof paymentRows)[number]>();
  for (const row of paymentRows) {
    if (!latestPayment.has(row.applicationId)) latestPayment.set(row.applicationId, row);
  }
  const latestQuote = new Map<string, (typeof quoteRows)[number]>();
  for (const row of quoteRows) {
    if (!latestQuote.has(row.applicationId)) latestQuote.set(row.applicationId, row);
  }

  const secretConfigured = isResumeEmailLinkSecretConfigured();
  const loaded: TCheckoutRecoveryLoaded[] = [];
  for (const row of rows) {
    const to = row.app.userId
      ? row.userEmail?.trim() || row.app.guestEmail?.trim() || null
      : row.app.guestEmail?.trim() || null;
    if (!to) continue;
    const pay = latestPayment.get(row.app.id) ?? null;
    const quote = latestQuote.get(row.app.id) ?? null;
    const draftExpiresAt = row.partyDraftExpiresAt ?? row.app.draftExpiresAt;
    const checkoutAttempt = isAdminListCheckoutCreatedAttempt({
      applicationPaymentStatus: row.app.paymentStatus,
      latestPaymentStatus: pay?.status ?? null,
      latestPaymentFailureCode: pay?.failureCode ?? null,
    });
    const candidate: TCheckoutRecoveryCandidate = {
      hasEmail: true,
      isGuest: row.app.isGuest,
      guestResumeReady: guestCheckoutResumeReady({
        isGuest: row.app.isGuest,
        partyId: row.app.partyId,
        draftExpiresAt,
        now: params.now,
        secretConfigured,
      }),
      applicationStatus: row.app.applicationStatus,
      paymentStatus: row.app.paymentStatus,
      latestPaymentStatus: pay?.status ?? null,
      checkoutAttempt,
      checkoutCreatedAt: pay?.createdAt ?? null,
      alreadySent: false,
    };
    loaded.push({
      applicationId: row.app.id,
      partyId: row.app.partyId,
      isGuest: row.app.isGuest,
      to: to.toLowerCase(),
      locale: "en",
      fullName: row.app.fullName,
      visaName: row.serviceName,
      reference: row.app.referenceNumber ?? row.app.id.slice(0, 8),
      draftExpiresAt,
      paymentProvider: pay?.provider ?? null,
      amountMinor: pay?.amount ?? quote?.totalAmount ?? null,
      currency: pay?.currency ?? quote?.currency ?? row.app.catalogCurrency,
      candidate,
    });
  }
  return loaded;
};
