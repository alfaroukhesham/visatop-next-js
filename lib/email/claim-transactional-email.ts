import { withSystemDbActor } from "@/lib/db/actor-context";
import { transactionalEmailSent } from "@/lib/db/schema";
import type { TransactionalEmailKind } from "./transactional-email-kinds";

/**
 * @returns true if this caller won the idempotency row (should send).
 */
export async function tryClaimTransactionalEmail(
  applicationId: string,
  kind: TransactionalEmailKind,
): Promise<boolean> {
  return withSystemDbActor(async (tx) => {
    const [row] = await tx
      .insert(transactionalEmailSent)
      .values({ applicationId, kind })
      .onConflictDoNothing({
        target: [transactionalEmailSent.applicationId, transactionalEmailSent.kind],
      })
      .returning({ id: transactionalEmailSent.id });
    return Boolean(row);
  });
}
