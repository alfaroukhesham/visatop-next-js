import type { DbTransaction } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

type Tx = DbTransaction;

export type AdminAuditInput = {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeJson?: string | null;
  afterJson?: string | null;
};

export async function writeAdminAudit(tx: Tx, input: AdminAuditInput): Promise<void> {
  await tx.insert(auditLog).values({
    actorType: "admin",
    actorId: input.adminUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: input.beforeJson ?? null,
    afterJson: input.afterJson ?? null,
  });
}
