import { and, desc, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type { application } from "@/lib/db/schema";
import type { DbTransaction } from "@/lib/db";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { payment } from "@/lib/db/schema/payments";
import { priceQuote } from "@/lib/db/schema/applications";
import {
  toPublicApplication,
  type TApplicationCharge,
} from "@/lib/applications/public-application";

/** Paid payment first, else the latest locked checkout quote. */
export const loadLatestApplicationCharge = async (
  tx: DbTransaction,
  applicationId: string,
): Promise<TApplicationCharge | null> => {
  const [paid] = await tx
    .select({
      amountMinor: payment.amount,
      currency: payment.currency,
    })
    .from(payment)
    .where(and(eq(payment.applicationId, applicationId), eq(payment.status, "paid")))
    .orderBy(desc(payment.updatedAt))
    .limit(1);

  if (paid) {
    return { amountMinor: paid.amountMinor, currency: paid.currency };
  }

  const [quote] = await tx
    .select({
      amountMinor: priceQuote.totalAmount,
      currency: priceQuote.currency,
    })
    .from(priceQuote)
    .where(eq(priceQuote.applicationId, applicationId))
    .orderBy(desc(priceQuote.lockedAt))
    .limit(1);

  if (!quote) return null;
  return { amountMinor: quote.amountMinor, currency: quote.currency };
};

export const toPublicApplicationWithCharge = async (
  row: InferSelectModel<typeof application>,
) => {
  const charge = await withSystemDbActor((tx) => loadLatestApplicationCharge(tx, row.id));
  return toPublicApplication(row, charge);
};
