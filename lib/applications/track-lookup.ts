import { desc, eq, or, sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, user } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

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
  const contact = parseTrackContact(contactRaw);
  if (contact.kind === "email" && !contact.email) return [];
  if (contact.kind === "phone" && !contact.digits) return [];

  if (contact.kind === "email") {
    const rows = await tx
      .select({ app: application })
      .from(application)
      .leftJoin(user, eq(application.userId, user.id))
      .where(
        or(
          eq(application.guestEmail, contact.email),
          sql`lower(trim(coalesce(${application.guestEmail}, ''))) = ${contact.email}`,
          sql`lower(trim(coalesce(${user.email}, ''))) = ${contact.email}`,
        ),
      )
      .orderBy(desc(application.updatedAt))
      .limit(TRACK_LOOKUP_LIMIT);
    return rows.map((r) => r.app);
  }

  // Normalizes formatting at query time; index-friendly path would store digits-only on write.
  const rows = await tx
    .select({ app: application })
    .from(application)
    .where(
      sql`regexp_replace(coalesce(${application.phone}, ''), '[^0-9]', '', 'g') = ${contact.digits}`,
    )
    .orderBy(desc(application.updatedAt))
    .limit(TRACK_LOOKUP_LIMIT);

  return rows.map((r) => r.app);
}
