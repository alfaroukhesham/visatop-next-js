import { eq } from "drizzle-orm";
import { hashResumeToken, guestResumeTokenMatchKind } from "@/lib/applications/resume-token";
import type { DbTransaction } from "@/lib/db";
import { application, applicationParty } from "@/lib/db/schema";

export const promotePreviousResumeTokenIfMatched = async (
  tx: DbTransaction,
  row: {
    id: string;
    partyId: string | null;
    resumeTokenHash: string | null;
    previousResumeTokenHash: string | null;
    previousResumeTokenExpiresAt: Date | null;
  },
  plainToken: string,
  now: Date = new Date(),
): Promise<"current" | "previous" | null> => {
  const kind = guestResumeTokenMatchKind(plainToken, row, now);
  if (kind !== "previous") return kind;
  const nextHash = hashResumeToken(plainToken);
  await tx
    .update(application)
    .set({
      resumeTokenHash: nextHash,
      previousResumeTokenHash: null,
      previousResumeTokenExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(application.id, row.id));
  if (row.partyId) {
    await tx
      .update(applicationParty)
      .set({
        resumeTokenHash: nextHash,
        previousResumeTokenHash: null,
        previousResumeTokenExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(applicationParty.id, row.partyId));
  }
  return "previous";
};
