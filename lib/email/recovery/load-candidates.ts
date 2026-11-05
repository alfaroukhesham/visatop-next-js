import { and, asc, desc, eq, gt, inArray, isNotNull, notInArray, or } from "drizzle-orm";
import { isAdminListCheckoutCreatedAttempt } from "@/lib/applications/admin-list-status";
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

export const loadCheckoutRecoveryCandidates = async (
  tx: DbTransaction,
  now: Date,
  lookbackDays: number,
  limit: number,
): Promise<TCheckoutRecoveryLoaded[]> => {
  const since = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const rows = await tx
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
        notInArray(application.applicationStatus, [...SKIP_APPLICATION_STATUSES]),
        notInArray(application.paymentStatus, ["paid", "refunded", "refund_pending"]),
        gt(application.updatedAt, since),
        or(isNotNull(application.guestEmail), isNotNull(application.userId)),
      ),
    )
    .orderBy(asc(application.updatedAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.app.id);
  const [paymentRows, sentRows, quoteRows] = await Promise.all([
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
        applicationId: transactionalEmailSent.applicationId,
      })
      .from(transactionalEmailSent)
      .where(
        and(
          inArray(transactionalEmailSent.applicationId, ids),
          eq(transactionalEmailSent.kind, CHECKOUT_RECOVERY_KIND),
        ),
      ),
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
  const sentSet = new Set(sentRows.map((r) => r.applicationId));
  const latestQuote = new Map<string, (typeof quoteRows)[number]>();
  for (const row of quoteRows) {
    if (!latestQuote.has(row.applicationId)) latestQuote.set(row.applicationId, row);
  }

  const loaded: TCheckoutRecoveryLoaded[] = [];
  for (const row of rows) {
    const to = row.app.userId
      ? row.userEmail?.trim() || row.app.guestEmail?.trim() || null
      : row.app.guestEmail?.trim() || null;
    if (!to) continue;
    const pay = latestPayment.get(row.app.id) ?? null;
    const quote = latestQuote.get(row.app.id) ?? null;
    const checkoutAttempt = isAdminListCheckoutCreatedAttempt({
      applicationPaymentStatus: row.app.paymentStatus,
      latestPaymentStatus: pay?.status ?? null,
      latestPaymentFailureCode: pay?.failureCode ?? null,
    });
    const candidate: TCheckoutRecoveryCandidate = {
      hasEmail: true,
      applicationStatus: row.app.applicationStatus,
      paymentStatus: row.app.paymentStatus,
      checkoutAttempt,
      checkoutCreatedAt: checkoutAttempt ? (pay?.createdAt ?? null) : null,
      alreadySent: sentSet.has(row.app.id),
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
      draftExpiresAt: row.partyDraftExpiresAt ?? row.app.draftExpiresAt,
      paymentProvider: pay?.provider ?? null,
      amountMinor: pay?.amount ?? quote?.totalAmount ?? null,
      currency: pay?.currency ?? quote?.currency ?? row.app.catalogCurrency,
      candidate,
    });
  }
  return loaded;
};
