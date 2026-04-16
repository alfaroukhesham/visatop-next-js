import { eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { platformSetting } from "@/lib/db/schema";

export const PLATFORM_KEY_DRAFT_TTL_HOURS = "draft_ttl_hours";

export const DEFAULT_DRAFT_TTL_HOURS = 48;

type DbTx = DbTransaction;

/** Normalize stored `platform_setting.value` for `draft_ttl_hours`. */
export function parseDraftTtlHoursFromStored(value: string | null | undefined): number {
  if (value === undefined || value === null || value === "") return DEFAULT_DRAFT_TTL_HOURS;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 24 * 365) return DEFAULT_DRAFT_TTL_HOURS;
  return n;
}

export async function getDraftTtlHoursFromTx(tx: DbTx): Promise<number> {
  const rows = await tx
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, PLATFORM_KEY_DRAFT_TTL_HOURS))
    .limit(1);
  return parseDraftTtlHoursFromStored(rows[0]?.value);
}

export function computeDraftExpiresAt(createdAt: Date, ttlHours: number): Date {
  return new Date(createdAt.getTime() + ttlHours * 3600 * 1000);
}
