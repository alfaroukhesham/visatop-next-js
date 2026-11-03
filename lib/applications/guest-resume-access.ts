import { eq } from "drizzle-orm";
import { promotePreviousResumeTokenIfMatched } from "@/lib/applications/promote-previous-resume-token";
import { guestResumeTokenMatches } from "@/lib/applications/resume-token";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema";

export type TGuestResumeLoadResult = {
  row: typeof application.$inferSelect;
  matchKind: "current" | "previous";
  resumePlain: string;
};

/**
 * Load a guest application row when the caller holds a valid `vt_resume`
 * plaintext for that id. Used by guest-facing routes (prepare, submitted, GET
 * application) — same verification as `app/api/applications/[id]/route.ts`.
 */
export const loadGuestApplicationRowByResumeCookie = async (
  applicationId: string,
  resumePlain: string | readonly string[],
): Promise<typeof application.$inferSelect | null> => {
  const loaded = await loadGuestApplicationByResumeCookie(applicationId, resumePlain);
  return loaded?.row ?? null;
};

const resumePlains = (resumePlain: string | readonly string[]): string[] =>
  typeof resumePlain === "string" ? [resumePlain] : [...resumePlain];

export const loadGuestApplicationByResumeCookie = async (
  applicationId: string,
  resumePlain: string | readonly string[],
): Promise<TGuestResumeLoadResult | null> => {
  const tokens = resumePlains(resumePlain).filter((token) => token.trim());
  if (tokens.length === 0) return null;
  return withSystemDbActor(async (tx) => {
    const rows = await tx
      .select()
      .from(application)
      .where(eq(application.id, applicationId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (!row.isGuest) return null;
    for (const token of tokens) {
      if (!guestResumeTokenMatches(token, row)) continue;
      const matchKind = (await promotePreviousResumeTokenIfMatched(tx, row, token)) ?? "current";
      return { row, matchKind, resumePlain: token };
    }
    return null;
  });
};
