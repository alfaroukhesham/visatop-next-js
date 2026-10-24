import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { resolveApplicantEmailTx } from "@/lib/email/resolve-applicant-email";
import { loadPartyMemberIds } from "@/lib/payments/ziina-checkout-session";
import {
  fincraCheckoutUrlFromPayCode,
  isTrustedFincraCheckoutUrl,
} from "@/lib/payments/fincra-embedded";
import { buildFincraInlineCheckoutData, type TFincraInlineCheckoutData } from "@/lib/payments/fincra-inline";
import { nextFincraAttemptReference } from "@/lib/payments/fincra-attempt-reference";
import { reconcileFincraPaymentFromReturn } from "@/lib/payments/reconcile-fincra-payments";
import { getFincraServerConfig } from "@/lib/payments/resolve-payment-provider";
import type { TResumeCheckoutSession } from "@/lib/payments/checkout-types";

export const loadOpenFincraPayment = async (tx: DbTransaction, memberIds: string[]) => {
  const rows = await tx
    .select()
    .from(schema.payment)
    .where(
      and(
        inArray(schema.payment.applicationId, memberIds),
        eq(schema.payment.provider, "fincra"),
        eq(schema.payment.status, "checkout_created"),
      ),
    )
    .orderBy(desc(schema.payment.createdAt))
    .limit(1);
  return rows[0] ?? null;
};

export const findOpenFincraPaymentForApplication = async (tx: DbTransaction, applicationId: string) => {
  const memberIds = await loadPartyMemberIds(tx, applicationId);
  if (!memberIds) return null;
  return loadOpenFincraPayment(tx, memberIds);
};

export const buildFincraInlineCheckoutDataForPayment = async (
  tx: DbTransaction,
  payRow: typeof schema.payment.$inferSelect,
): Promise<TFincraInlineCheckoutData | null> => {
  let cfg;
  try {
    cfg = getFincraServerConfig();
  } catch {
    return null;
  }
  const [app] = await tx
    .select()
    .from(schema.application)
    .where(eq(schema.application.id, payRow.applicationId))
    .limit(1);
  if (!app) return null;
  const customerEmail = await resolveApplicantEmailTx(tx, app);
  if (!customerEmail) return null;
  const metadata: Record<string, string> = {
    applicationId: app.id,
    paymentId: payRow.id,
    serviceId: app.serviceId,
    isGuest: app.isGuest ? "true" : "false",
  };
  if (app.partyId) metadata.partyId = app.partyId;
  if (app.userId) metadata.userId = app.userId;
  return buildFincraInlineCheckoutData({
    publicKey: cfg.publicKey,
    amountMinor: payRow.amount,
    customer: {
      name: app.fullName?.trim() || "VisaTop customer",
      email: customerEmail,
      phoneNumber: app.phone,
    },
    reference: payRow.providerOperationId?.trim() || nextFincraAttemptReference(payRow.id, payRow.providerOperationId),
    feeBearer: cfg.feeBearer,
    metadata,
  });
};

export const rotateOpenFincraInlineAttempt = async (
  tx: DbTransaction,
  params: {
    payRow: typeof schema.payment.$inferSelect;
    memberIds: string[];
    requestId: string | null;
  },
): Promise<TFincraInlineCheckoutData | null> => {
  const nextReference = nextFincraAttemptReference(params.payRow.id, params.payRow.providerOperationId);
  await tx
    .update(schema.application)
    .set({ checkoutState: "pending" })
    .where(and(inArray(schema.application.id, params.memberIds), ne(schema.application.paymentStatus, "paid")));
  await tx
    .update(schema.payment)
    .set({ providerOperationId: nextReference })
    .where(eq(schema.payment.id, params.payRow.id));
  await tx.insert(schema.auditLog).values({
    actorType: "system",
    actorId: null,
    action: "payment_fincra_attempt_rotated",
    entityType: "payment",
    entityId: params.payRow.id,
    afterJson: JSON.stringify({
      previousReference: params.payRow.providerOperationId ?? params.payRow.id,
      nextReference,
      requestId: params.requestId,
    }),
  });
  return buildFincraInlineCheckoutDataForPayment(tx, {
    ...params.payRow,
    providerOperationId: nextReference,
  });
};

export type TResolveFincraCheckoutSessionResult = {
  session: TResumeCheckoutSession;
  firstPaidApplicationId: string | null;
};

const result = (
  session: TResumeCheckoutSession,
  firstPaidApplicationId: string | null = null,
): TResolveFincraCheckoutSessionResult => ({ session, firstPaidApplicationId });

export const resolveFincraCheckoutSession = async (
  tx: DbTransaction,
  applicationId: string,
  requestId: string | null,
): Promise<TResolveFincraCheckoutSessionResult> => {
  const memberIds = await loadPartyMemberIds(tx, applicationId);
  if (!memberIds) return result({ kind: "none" });

  const [appRow] = await tx
    .select({ paymentStatus: schema.application.paymentStatus })
    .from(schema.application)
    .where(eq(schema.application.id, applicationId))
    .limit(1);
  if (appRow?.paymentStatus === "paid") return result({ kind: "paid" });

  const payRow = await loadOpenFincraPayment(tx, memberIds);
  if (!payRow) return result({ kind: "none" });

  const attempt = await reconcileFincraPaymentFromReturn(tx, payRow, requestId);
  const firstPaidApplicationId = attempt.process?.firstPaidApplicationId ?? null;
  if (firstPaidApplicationId || attempt.outcome === "applied") {
    const [updated] = await tx
      .select({ paymentStatus: schema.application.paymentStatus })
      .from(schema.application)
      .where(eq(schema.application.id, applicationId))
      .limit(1);
    if (updated?.paymentStatus === "paid") return result({ kind: "paid" }, firstPaidApplicationId);
    if (firstPaidApplicationId) return result({ kind: "paid" }, firstPaidApplicationId);
  }

  if (attempt.outcome === "mismatch" || attempt.outcome === "underpaid") {
    return result({ kind: "closed", status: "mismatch" });
  }

  const payCode = payRow.providerCheckoutId?.trim() ?? "";
  const redirectUrl = payCode ? fincraCheckoutUrlFromPayCode(payCode) : "";
  if (redirectUrl && isTrustedFincraCheckoutUrl(redirectUrl)) {
    return result({ kind: "fincra_redirect", redirectUrl });
  }

  const inline = await buildFincraInlineCheckoutDataForPayment(tx, payRow);
  if (inline) return result({ kind: "fincra_inline", checkout: inline });
  return result({ kind: "unavailable" });
};
