import { eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application } from "@/lib/db/schema";
import type { CheckoutBlockReason } from "./checkout-client-messages";

export type CheckoutBlockDiagnosis = {
  reason: CheckoutBlockReason;
  applicationStatus?: string;
  paymentStatus?: string;
  checkoutState?: string | null;
};

/**
 * Explains why the checkout row lock failed (409) without exposing internal jargon.
 */
export async function diagnoseCheckoutBlock(
  tx: DbTransaction,
  applicationId: string,
): Promise<CheckoutBlockDiagnosis> {
  const [row] = await tx
    .select({
      applicationStatus: application.applicationStatus,
      paymentStatus: application.paymentStatus,
      checkoutState: application.checkoutState,
    })
    .from(application)
    .where(eq(application.id, applicationId))
    .limit(1);

  if (!row) {
    return { reason: "unknown" };
  }

  const checkoutState = row.checkoutState ?? "none";
  const inFlight =
    checkoutState === "pending" ||
    row.paymentStatus === "checkout_created";

  if (inFlight) {
    return {
      reason: "checkout_in_progress",
      applicationStatus: row.applicationStatus,
      paymentStatus: row.paymentStatus,
      checkoutState,
    };
  }

  if (row.applicationStatus !== "ready_for_payment") {
    return {
      reason: "not_ready_for_payment",
      applicationStatus: row.applicationStatus,
      paymentStatus: row.paymentStatus,
      checkoutState,
    };
  }

  return {
    reason: "unknown",
    applicationStatus: row.applicationStatus,
    paymentStatus: row.paymentStatus,
    checkoutState,
  };
}
