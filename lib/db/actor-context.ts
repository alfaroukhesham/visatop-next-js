import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db, type DbTransaction } from "@/lib/db";
import {
  adminPermission,
  adminRolePermission,
  adminUserRole,
} from "@/lib/db/schema";

export type AdminDbActorContext = {
  tx: DbTransaction;
  permissions: string[];
};

export type DbActorType = "admin" | "client" | "system";

export type DbActor = {
  type: DbActorType;
  id?: string | null;
  permissions?: string[] | null;
};

function permissionsToSetting(perms?: string[] | null): string {
  // Comma-delimited list. The DB helper `app_has_permission` wraps with commas
  // before searching to prevent substring false-positives.
  return (perms ?? []).join(",");
}

async function setActorGucs(tx: DbTransaction, actor: DbActor) {
  const actorType = actor.type;
  const actorId = actor.id ?? "";
  const actorPerms = permissionsToSetting(actor.permissions);

  // Session GUCs only persist within the same transaction; run all queries on `tx`.
  await tx.execute(
    sql`select
      set_config('app.actor_type', ${actorType}, true),
      set_config('app.actor_id', ${actorId}, true),
      set_config('app.actor_permissions', ${actorPerms}, true)
    `,
  );
}

export async function resolveAdminPermissions(
  adminUserId: string,
  tx?: DbTransaction,
) {
  const q = (tx ?? db)
    .select({ key: adminPermission.key })
    .from(adminUserRole)
    .innerJoin(
      adminRolePermission,
      eq(adminRolePermission.roleId, adminUserRole.roleId),
    )
    .innerJoin(
      adminPermission,
      eq(adminPermission.key, adminRolePermission.permissionKey),
    )
    .where(eq(adminUserRole.adminUserId, adminUserId));

  const rows = await q;
  return [...new Set(rows.map((r) => r.key))];
}

/**
 * Run a DB operation within an actor-scoped transaction.
 *
 * Why transaction?
 * - `set_config(...)` is session-scoped; the transaction keeps one connection/session.
 */
export async function withDbActor<T>(
  actor: DbActor,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setActorGucs(tx, actor);
    return fn(tx);
  });
}

export async function withAdminDbActor<T>(
  adminUserId: string,
  fn: (ctx: AdminDbActorContext) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const permissions = await resolveAdminPermissions(adminUserId, tx);
    await setActorGucs(tx, { type: "admin", id: adminUserId, permissions });
    return fn({ tx, permissions });
  });
}

export async function withClientDbActor<T>(
  userId: string,
  fn: (tx: DbTransaction) => Promise<T>,
) {
  return withDbActor({ type: "client", id: userId, permissions: [] }, fn);
}

export async function withSystemDbActor<T>(
  fn: (tx: DbTransaction) => Promise<T>,
) {
  return withDbActor({ type: "system", id: null, permissions: [] }, fn);
}

