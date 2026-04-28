import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, user } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import type { Cursor } from "@/lib/api/cursor";

type ApplicationRow = InferSelectModel<typeof application>;

const TRACK_LOOKUP_LIMIT = 50;

export function normalizeEmailInput(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s.includes("@")) return null;
  return s;
}

/** Digits only, for comparison with stored profile phone. */
export function normalizePhoneDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits;
}

export function parseTrackContact(raw: string): { kind: "email"; email: string } | { kind: "phone"; digits: string } {
  const trimmed = raw.trim();
  const email = normalizeEmailInput(trimmed);
  if (email) return { kind: "email", email };
  const digits = normalizePhoneDigits(trimmed);
  if (digits) return { kind: "phone", digits };
  return { kind: "phone", digits: "" };
}

export function isValidTrackContact(raw: string): boolean {
  const c = parseTrackContact(raw);
  return (c.kind === "email" && Boolean(c.email)) || (c.kind === "phone" && Boolean(c.digits));
}

/**
 * Lists applications matching the given email (guest or account) or profile phone digits.
 * Ordered by most recently updated. Intended for the public track page only.
 *
 * Guest email: `eq` on the stored value (writes are normalized) plus a lower(trim) fallback for
 * legacy rows. Linked-account email may differ in casing; user side uses lower(trim) in SQL.
 * Phone uses regexp_replace on read; a dedicated digits column + index would scale better if
 * this endpoint becomes hot.
 */
export async function findApplicationsForContactTrackLookup(
  tx: DbTransaction,
  contactRaw: string,
): Promise<ApplicationRow[]> {
  const rows = await findApplicationsForContactTrackLookupPaginated(tx, contactRaw, {
    limit: TRACK_LOOKUP_LIMIT,
    cursor: null,
  });
  return rows.items;
}

export async function findApplicationsForContactTrackLookupPaginated(
  tx: DbTransaction,
  contactRaw: string,
  opts: { limit: number; cursor: Cursor | null },
): Promise<{ items: ApplicationRow[]; hasMore: boolean }> {
  const contact = parseTrackContact(contactRaw);
  if (contact.kind === "email" && !contact.email) return { items: [], hasMore: false };
  if (contact.kind === "phone" && !contact.digits) return { items: [], hasMore: false };

  const limit = Math.max(1, Math.min(TRACK_LOOKUP_LIMIT, Math.floor(opts.limit)));

  const cursorWhere = opts.cursor
    ? or(
        lt(application.createdAt, new Date(opts.cursor.createdAt)),
        and(eq(application.createdAt, new Date(opts.cursor.createdAt)), lt(application.id, opts.cursor.id)),
      )
    : undefined;

  if (contact.kind === "email") {
    const baseWhere = or(
      eq(application.guestEmail, contact.email),
      sql`lower(trim(coalesce(${application.guestEmail}, ''))) = ${contact.email}`,
      sql`lower(trim(coalesce(${user.email}, ''))) = ${contact.email}`,
    );

    const rows = await tx
      .select({ app: application })
      .from(application)
      .leftJoin(user, eq(application.userId, user.id))
      .where(cursorWhere ? and(baseWhere, cursorWhere) : baseWhere)
      .orderBy(desc(application.createdAt), desc(application.id))
      .limit(limit + 1);

    const apps = rows.map((r) => r.app);
    const hasMore = apps.length > limit;
    return { items: hasMore ? apps.slice(0, limit) : apps, hasMore };
  }

  const baseWhere = sql`regexp_replace(coalesce(${application.phone}, ''), '[^0-9]', '', 'g') = ${contact.digits}`;
  const where = cursorWhere ? and(baseWhere, cursorWhere) : baseWhere;

  const rows = await tx
    .select({ app: application })
    .from(application)
    .where(where)
    .orderBy(desc(application.createdAt), desc(application.id))
    .limit(limit + 1);

  const apps = rows.map((r) => r.app);
  const hasMore = apps.length > limit;
  return { items: hasMore ? apps.slice(0, limit) : apps, hasMore };
}
