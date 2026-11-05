import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { DbTransaction } from "@/lib/db";
import { paymentFincraAttempt } from "@/lib/db/schema";
import { fincraAttemptNumberForReference } from "@/lib/payments/fincra-attempt-reference";

export const recordFincraAttemptReference = async (
  tx: DbTransaction,
  params: { paymentId: string; merchantReference: string },
): Promise<void> => {
  const merchantReference = params.merchantReference.trim();
  if (!merchantReference) return;
  await tx
    .insert(paymentFincraAttempt)
    .values({
      id: createId(),
      paymentId: params.paymentId,
      merchantReference,
      attemptNumber: fincraAttemptNumberForReference(params.paymentId, merchantReference),
    })
    .onConflictDoNothing({ target: paymentFincraAttempt.merchantReference });
};

export const listStoredFincraAttemptReferences = async (
  tx: DbTransaction,
  paymentId: string,
): Promise<string[]> => {
  const rows = await tx
    .select({ merchantReference: paymentFincraAttempt.merchantReference })
    .from(paymentFincraAttempt)
    .where(eq(paymentFincraAttempt.paymentId, paymentId));
  return rows.map((row) => row.merchantReference);
};

export const listFincraMerchantReferencesForPayment = (
  payRow: {
    id: string;
    providerOperationId?: string | null;
  },
  storedReferences: string[] = [],
): string[] => {
  const refs: string[] = [];
  const add = (value?: string | null) => {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) return;
    if (refs.includes(trimmed)) return;
    refs.push(trimmed);
  };
  add(payRow.providerOperationId);
  for (const stored of storedReferences) add(stored);
  add(payRow.id);
  return refs;
};
