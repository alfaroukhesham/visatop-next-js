import { eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, user } from "@/lib/db/schema";

/**
 * Logged-in applicants: `user.email`. Guests: `application.guest_email` (required for guests at API layer).
 */
export async function resolveApplicantEmailTx(
  tx: DbTransaction,
  app: Pick<typeof application.$inferSelect, "userId" | "guestEmail">,
): Promise<string | null> {
  if (app.userId) {
    const [u] = await tx.select({ email: user.email }).from(user).where(eq(user.id, app.userId)).limit(1);
    return u?.email?.trim() ? u.email.trim() : null;
  }
  const g = app.guestEmail?.trim();
  return g ? g.toLowerCase() : null;
}
