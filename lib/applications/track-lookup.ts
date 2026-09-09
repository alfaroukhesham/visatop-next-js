import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, user } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import type { Cursor } from "@/lib/api/cursor";
import { computeClientApplicationTracking } from "@/lib/applications/user-facing-tracking";
import { verifyResumeToken } from "@/lib/applications/resume-token";

type ApplicationRow = InferSelectModel<typeof application>;

const TRACK_LOOKUP_LIMIT = 50;

const RESUMABLE_TRACK_PAYMENT_STATUSES = new Set(["unpaid", "checkout_created"]);

export type TCanContinueTrackRowInput = {
  cookiePlain: string | null;
  rowHash: string | null;
  paymentStatus: string;
};

export const canContinueTrackRow = (input: TCanContinueTrackRowInput): boolean => {
  if (!input.cookiePlain || !input.rowHash) return false;
  if (!RESUMABLE_TRACK_PAYMENT_STATUSES.has(input.paymentStatus)) return false;
  return verifyResumeToken(input.cookiePlain, input.rowHash);
};

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

export type TTrackLookup =
  | { kind: "email"; email: string }
  | { kind: "phone"; digits: string }
  | { kind: "trackingId"; value: string };

/** Guest tracking IDs: full application UUID, 8-char id prefix, or reference number. */
export function normalizeTrackingId(raw: string): string | null {
  const s = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/.test(s)) return null;
  if (/^\d+$/.test(s)) return null;
  return s;
}

export function parseTrackContact(raw: string): TTrackLookup {
  const trimmed = raw.trim();
  const email = normalizeEmailInput(trimmed);
  if (email) return { kind: "email", email };
  const digits = normalizePhoneDigits(trimmed);
  if (digits) return { kind: "phone", digits };
  const trackingId = normalizeTrackingId(trimmed);
  if (trackingId) return { kind: "trackingId", value: trackingId };
  return { kind: "phone", digits: "" };
}

export function isValidTrackContact(raw: string): boolean {
  const c = parseTrackContact(raw);
  return (
    (c.kind === "email" && Boolean(c.email)) ||
    (c.kind === "phone" && Boolean(c.digits)) ||
    c.kind === "trackingId"
  );
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
  if (contact.kind === "trackingId" && !contact.value) return { items: [], hasMore: false };

  const limit = Math.max(1, Math.min(TRACK_LOOKUP_LIMIT, Math.floor(opts.limit)));

  const cursorWhere = opts.cursor
    ? or(
        lt(application.createdAt, new Date(opts.cursor.createdAt)),
        and(eq(application.createdAt, new Date(opts.cursor.createdAt)), lt(application.id, opts.cursor.id)),
      )
    : undefined;

  if (contact.kind === "trackingId") {
    const value = contact.value;
    const lower = value.toLowerCase();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    const isIdPrefix = /^[0-9a-f]{8}$/i.test(value);
    const baseWhere = isUuid
      ? eq(application.id, value)
      : isIdPrefix
        ? or(
            sql`lower(${application.id}) like ${`${lower}%`}`,
            sql`lower(trim(coalesce(${application.referenceNumber}, ''))) = ${lower}`,
          )
        : or(
            eq(application.id, value),
            sql`lower(trim(coalesce(${application.referenceNumber}, ''))) = ${lower}`,
          );
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

export type TrackLookupDisplayRow = {
  applicationId: string;
  referenceDisplay: string;
  nationalityCode: string;
  serviceId: string;
  serviceName: string;
  nationalityName: string;
  paymentStatus: string;
  clientTracking: ReturnType<typeof computeClientApplicationTracking>;
  canContinue: boolean;
  continueHref: string | null;
};

/**
 * Maps a track-lookup application row into the customer-facing display shape.
 * `serviceName` falls back to a generic "Visa" (never the raw id/UUID); `nationalityName`
 * is already resolved to a display name (ISO fallback handled by the caller).
 */
export function mapTrackLookupRow(
  row: {
    id: string;
    referenceNumber: string | null;
    nationalityCode: string;
    serviceId: string;
    applicationStatus: string;
    paymentStatus: string;
    fulfillmentStatus: string;
    adminAttentionRequired: boolean;
    resumeTokenHash?: string | null;
  },
  names: { serviceName: string | null; nationalityName: string },
  opts: { cookiePlain?: string | null; partyResumeTokenHash?: string | null } = {},
): TrackLookupDisplayRow {
  const rowHash = opts.partyResumeTokenHash ?? row.resumeTokenHash ?? null;
  const canContinue = canContinueTrackRow({
    cookiePlain: opts.cookiePlain ?? null,
    rowHash,
    paymentStatus: row.paymentStatus,
  });

  return {
    applicationId: row.id,
    referenceDisplay: row.referenceNumber ?? row.id.slice(0, 8),
    nationalityCode: row.nationalityCode,
    serviceId: row.serviceId,
    serviceName: names.serviceName ?? "Visa",
    nationalityName: names.nationalityName,
    paymentStatus: row.paymentStatus,
    clientTracking: computeClientApplicationTracking({
      applicationStatus: row.applicationStatus,
      paymentStatus: row.paymentStatus,
      fulfillmentStatus: row.fulfillmentStatus,
      adminAttentionRequired: row.adminAttentionRequired,
    }),
    canContinue,
    continueHref: canContinue ? `/apply/applications/${row.id}` : null,
  };
}
