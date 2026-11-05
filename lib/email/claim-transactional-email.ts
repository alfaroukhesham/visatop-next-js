import { and, eq } from "drizzle-orm";
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

/** Drop a claim so a later cron can retry (e.g. Mailgun rejected the message). */
export async function releaseTransactionalEmailClaim(
  applicationId: string,
  kind: TransactionalEmailKind,
): Promise<void> {
  await withSystemDbActor(async (tx) => {
    await tx
      .delete(transactionalEmailSent)
      .where(
        and(
          eq(transactionalEmailSent.applicationId, applicationId),
          eq(transactionalEmailSent.kind, kind),
        ),
      );
  });
}
