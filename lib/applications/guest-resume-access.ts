import { eq } from "drizzle-orm";
import { verifyResumeToken } from "@/lib/applications/resume-token";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema";

/**
 * Load a guest application row when the caller holds a valid `vt_resume`
 * plaintext for that id. Used by guest-facing routes (prepare, submitted, GET
 * application) — same verification as `app/api/applications/[id]/route.ts`.
 */
export async function loadGuestApplicationRowByResumeCookie(
  applicationId: string,
  resumePlain: string,
): Promise<typeof application.$inferSelect | null> {
  return withSystemDbActor(async (tx) => {
    const rows = await tx
      .select()
      .from(application)
      .where(eq(application.id, applicationId))
      .limit(1);
    const row = rows[0];
    if (!row?.resumeTokenHash) return null;
    if (!verifyResumeToken(resumePlain, row.resumeTokenHash)) return null;
    if (!row.isGuest) return null;
    return row;
  });
}
