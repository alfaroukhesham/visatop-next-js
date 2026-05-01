import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadGuestApplicationRowByResumeCookie } from "@/lib/applications/guest-resume-access";
import {
  normalizeSignedInTrackEmail,
  signedInPortalTrackRowFilter,
} from "@/lib/applications/portal-track-application-access";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema/applications";

export type ApplicationRow = typeof application.$inferSelect;

/**
 * Loads full `application` row for cookie/header context: **valid `vt_resume`**
 * for a guest application (same priority as [`resolveApplicationAccess`](./application-access.ts)),
 * then signed-in owner or legacy guest row visible by matching account email
 * (same rule as track list). Returns null when there is no read access.
 */
export async function loadApplicationRowForRequest(
  applicationId: string,
  cookieHeader: string | null,
): Promise<ApplicationRow | null> {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  const token = readResumeTokenFromRequestCookies(cookieHeader);

  if (token) {
    const guestRow = await loadGuestApplicationRowByResumeCookie(applicationId, token);
    if (guestRow) return guestRow;
  }

  if (session) {
    const email = normalizeSignedInTrackEmail(session.user.email);
    return withSystemDbActor(async (tx) => {
      const rows = await tx
        .select()
        .from(application)
        .where(
          and(
            eq(application.id, applicationId),
            signedInPortalTrackRowFilter(session.user.id, email),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    });
  }

  return null;
}
