import { and, desc, eq, inArray } from "drizzle-orm";
import { parseChargeBreakdown, type TSettledRecap } from "@/lib/apply/charged-recap";
import type { DbTransaction } from "@/lib/db";
import { application } from "@/lib/db/schema";
import { priceQuote } from "@/lib/db/schema/applications";
import { payment } from "@/lib/db/schema/payments";

/** Paid amount first, otherwise the locked price quote, with extra lines from its breakdown. */
export const loadChargedRecap = async (
  tx: DbTransaction,
  applicationId: string,
): Promise<TSettledRecap | null> => {
  const [row] = await tx
    .select({ id: application.id, partyId: application.partyId })
    .from(application)
    .where(eq(application.id, applicationId))
    .limit(1);
  if (!row) return null;

  const members = row.partyId
    ? await tx
        .select({ id: application.id })
        .from(application)
        .where(eq(application.partyId, row.partyId))
    : [{ id: row.id }];
  const ids = members.map((member) => member.id);
  if (ids.length === 0) return null;

  const [paid] = await tx
    .select({ amount: payment.amount, currency: payment.currency })
    .from(payment)
    .where(and(inArray(payment.applicationId, ids), eq(payment.status, "paid")))
    .orderBy(desc(payment.updatedAt))
    .limit(1);

  const [quote] = await tx
    .select({
      totalAmount: priceQuote.totalAmount,
      currency: priceQuote.currency,
      breakdownJson: priceQuote.breakdownJson,
    })
    .from(priceQuote)
    .where(inArray(priceQuote.applicationId, ids))
    .orderBy(desc(priceQuote.lockedAt))
    .limit(1);

  if (!paid && !quote) return null;
  const lines = quote ? parseChargeBreakdown(quote.breakdownJson) : { visaLines: [], extraLines: [] };
  const amount = paid?.amount ?? quote!.totalAmount;
  const currency = (paid?.currency ?? quote!.currency).trim().toUpperCase();
  return {
    currency,
    totalAmountMinor: amount.toString(),
    visaLines: lines.visaLines,
    extraLines: lines.extraLines,
  };
};
