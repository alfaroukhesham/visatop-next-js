import { and, desc, eq, ilike, or, count } from "drizzle-orm";
import { type DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export type AdminListParams = {
  attention?: boolean;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listAdminApplications(
  tx: DbTransaction,
  params: AdminListParams
) {
  const conditions = [];

  if (params.attention) {
    conditions.push(eq(schema.application.adminAttentionRequired, true));
  }

  if (params.status) {
    conditions.push(eq(schema.application.applicationStatus, params.status));
  }

  if (params.search) {
    conditions.push(
      or(
        ilike(schema.application.id, `%${params.search}%`),
        ilike(schema.application.referenceNumber, `%${params.search}%`),
        ilike(schema.application.guestEmail, `%${params.search}%`)
      )
    );
  }

  const query = tx
    .select()
    .from(schema.application)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.application.createdAt))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);

  const totalQuery = tx
    .select({ value: count() })
    .from(schema.application)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const [rows, [totalResult]] = await Promise.all([query, totalQuery]);

  return {
    items: rows,
    total: totalResult.value,
  };
}

export async function getAttentionRequiredCount(tx: DbTransaction) {
  const [result] = await tx
    .select({ value: count() })
    .from(schema.application)
    .where(eq(schema.application.adminAttentionRequired, true));
  return result.value;
}
