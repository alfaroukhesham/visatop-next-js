import { and, asc, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, payment } from "@/lib/db/schema";

export type TPartyCheckoutMember = {
  id: string;
  checkoutState: string | null;
};

/**
 * Pending rows in this party that one cancel must release.
 * Null when the requested application is not itself pending.
 */
export const partyPendingIdsToRelease = (
  requestedApplicationId: string,
  members: readonly TPartyCheckoutMember[],
): string[] | null => {
  const requested = members.find((member) => member.id === requestedApplicationId);
  if (!requested || requested.checkoutState !== "pending") return null;
  const pendingIds = members.filter((member) => member.checkoutState === "pending").map((member) => member.id);
  return pendingIds.length > 0 ? pendingIds : null;
};

/**
 * Release every pending member of the attempt, not only the row in the URL.
 * Rows are locked with SELECT … FOR UPDATE in traveller order, the same party
 * rows checkout updates when it sets checkout_state = pending.
 */
export const cancelPartyCheckout = async (
  tx: DbTransaction,
  applicationId: string,
): Promise<{ ok: true; releasedIds: string[] } | { ok: false }> => {
  const [requested] = await tx
    .select({
      id: application.id,
      partyId: application.partyId,
      checkoutState: application.checkoutState,
    })
    .from(application)
    .where(eq(application.id, applicationId))
    .for("update")
    .limit(1);
  if (!requested) return { ok: false };

  const members = requested.partyId
    ? await tx
        .select({
          id: application.id,
          checkoutState: application.checkoutState,
        })
        .from(application)
        .where(eq(application.partyId, requested.partyId))
        .orderBy(asc(application.travelerIndex))
        .for("update")
    : [{ id: requested.id, checkoutState: requested.checkoutState }];

  const releasedIds = partyPendingIdsToRelease(applicationId, members);
  if (!releasedIds) return { ok: false };

  await tx
    .update(application)
    .set({ checkoutState: "none", paymentStatus: "unpaid" })
    .where(and(inArray(application.id, releasedIds), eq(application.checkoutState, "pending")));

  await tx
    .update(payment)
    .set({ status: "failed" })
    .where(and(inArray(payment.applicationId, releasedIds), eq(payment.status, "checkout_created")));

  return { ok: true, releasedIds };
};
