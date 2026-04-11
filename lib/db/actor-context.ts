import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { db } from "@/lib/db";
import {
  adminPermission,
  adminRolePermission,
  adminUserRole,
} from "@/lib/db/schema";

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

async function setActorGucs(
  tx: NeonHttpDatabase<Record<string, never>>,
  actor: DbActor,
) {
  const actorType = actor.type;
  const actorId = actor.id ?? "";
  const actorPerms = permissionsToSetting(actor.permissions);

  // NOTE: With Neon HTTP, session GUCs only persist within the same transaction.
  // Always call this within `db.transaction(...)` and run all subsequent queries
  // on the passed `tx`.
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
  tx?: NeonHttpDatabase<Record<string, never>>,
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
 * - The current DB client uses Neon HTTP (stateless per query).
 * - `set_config(...)` only affects the current session; the transaction ensures
 *   all queries share the same session.
 */
export async function withDbActor<T>(
  actor: DbActor,
  fn: (tx: NeonHttpDatabase<Record<string, never>>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setActorGucs(tx as unknown as NeonHttpDatabase<Record<string, never>>, actor);
    return fn(tx as unknown as NeonHttpDatabase<Record<string, never>>);
  });
}

export async function withAdminDbActor<T>(
  adminUserId: string,
  fn: (tx: NeonHttpDatabase<Record<string, never>>) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const typedTx = tx as unknown as NeonHttpDatabase<Record<string, never>>;
    const permissions = await resolveAdminPermissions(adminUserId, typedTx);
    await setActorGucs(typedTx, { type: "admin", id: adminUserId, permissions });
    return fn(typedTx);
  });
}

export async function withClientDbActor<T>(
  userId: string,
  fn: (tx: NeonHttpDatabase<Record<string, never>>) => Promise<T>,
) {
  return withDbActor({ type: "client", id: userId, permissions: [] }, fn);
}

export async function withSystemDbActor<T>(
  fn: (tx: NeonHttpDatabase<Record<string, never>>) => Promise<T>,
) {
  return withDbActor({ type: "system", id: null, permissions: [] }, fn);
}

