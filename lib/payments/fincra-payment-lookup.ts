import { eq, inArray, or } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { payment } from "@/lib/db/schema";
import { fincraWebhookLookupIds } from "@/lib/payments/fincra-attempt-reference";

export const findFincraPaymentForWebhookRefs = async (
  tx: DbTransaction,
  params: {
    merchantReference?: string | null;
    paymentIdFromMetadata?: string | null;
    providerPaymentId?: string | null;
  },
): Promise<typeof payment.$inferSelect | null> => {
  const payCode = params.providerPaymentId?.trim() ?? "";
  if (payCode) {
    const [byPayCode] = await tx
      .select()
      .from(payment)
      .where(eq(payment.providerCheckoutId, payCode))
      .limit(1);
    if (byPayCode) return byPayCode;
  }

  const ids = fincraWebhookLookupIds({
    merchantReference: params.merchantReference,
    paymentIdFromMetadata: params.paymentIdFromMetadata,
  });
  if (ids.length === 0) return null;
  const [row] = await tx
    .select()
    .from(payment)
    .where(or(inArray(payment.providerOperationId, ids), inArray(payment.id, ids)))
    .limit(1);
  return row ?? null;
};
