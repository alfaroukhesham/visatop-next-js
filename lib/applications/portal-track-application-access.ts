import { and, eq, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import { application } from "@/lib/db/schema/applications";

export function normalizeSignedInTrackEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = raw.trim().toLowerCase();
  return e && e.includes("@") ? e : null;
}

/**
 * Same visibility as the signed-in portal track list (`/api/portal/track-applications`):
 * owned `user_id` OR legacy guest row with matching `guest_email`, excluding unpaid drafts
 * past `draft_expires_at`.
 */
export function signedInPortalTrackRowFilter(
  sessionUserId: string,
  normalizedEmail: string | null,
) {
  const ownedOrEmailMatch = or(
    eq(application.userId, sessionUserId),
    normalizedEmail
      ? and(
          isNull(application.userId),
          sql`lower(trim(coalesce(${application.guestEmail}, ''))) = ${normalizedEmail}`,
        )
      : sql`false`,
  );

  const expiredUnpaidDraft = and(
    eq(application.paymentStatus, "unpaid"),
    isNotNull(application.draftExpiresAt),
    lte(application.draftExpiresAt, sql`now()`),
  );

  return and(ownedOrEmailMatch, sql`NOT (${expiredUnpaidDraft})`);
}
