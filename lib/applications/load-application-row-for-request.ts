import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadGuestApplicationRowByResumeCookie } from "@/lib/applications/guest-resume-access";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";
import { withClientDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema";

export type ApplicationRow = typeof application.$inferSelect;

/**
 * Loads full `application` row for cookie/header context: signed-in owner or
 * guest with valid `vt_resume`. Returns null when there is no read access.
 */
export async function loadApplicationRowForRequest(
  applicationId: string,
  cookieHeader: string | null,
): Promise<ApplicationRow | null> {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  if (session) {
    return withClientDbActor(session.user.id, async (tx) => {
      const rows = await tx
        .select()
        .from(application)
        .where(and(eq(application.id, applicationId), eq(application.userId, session.user.id)))
        .limit(1);
      return rows[0] ?? null;
    });
  }
  const token = readResumeTokenFromRequestCookies(cookieHeader);
  if (!token) return null;
  return loadGuestApplicationRowByResumeCookie(applicationId, token);
}
