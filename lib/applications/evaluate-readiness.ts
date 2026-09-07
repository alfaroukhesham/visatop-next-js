import { eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  application,
  user,
} from "@/lib/db/schema";
import type { ValidationResult } from "@/lib/documents/validation-readiness";
import { computeValidation } from "@/lib/documents/validation-readiness";
import { loadPaymentUploadPresence } from "@/lib/applications/load-payment-upload-presence";

/**
 * Re-evaluates application readiness and auto-advances the applicationStatus.
 *
 * When **`paymentReadiness` is `ready`** (email + required uploads when pay-first;
 * full profile + validation when validation enabled):
 * - From `needs_review`, or from early lifecycle (`draft`, `needs_docs`, `extracting`),
 *   move to `ready_for_payment` so `/api/checkout` can take the lock (it requires that status).
 * When **`paymentReadiness` is not `ready`** and status is `ready_for_payment`, revert to `needs_review`.
 */
const READINESS_EVALUABLE_STATUSES = new Set([
  "draft",
  "needs_docs",
  "extracting",
  "needs_review",
  "ready_for_payment",
]);

/**
 * Pure decision used by `evaluateApplicationReadiness` (exported for unit tests).
 */
export function readinessPromotionAction(
  applicationStatus: string,
  validation: Pick<ValidationResult, "paymentReadiness">,
): "advance" | "revert" | "noop" {
  if (!READINESS_EVALUABLE_STATUSES.has(applicationStatus)) {
    return "noop";
  }
  const isPaymentReady = validation.paymentReadiness === "ready";
  const canAdvanceToPayment =
    isPaymentReady &&
    applicationStatus !== "ready_for_payment" &&
    (applicationStatus === "needs_review" ||
      applicationStatus === "draft" ||
      applicationStatus === "needs_docs" ||
      applicationStatus === "extracting");

  if (canAdvanceToPayment) return "advance";
  if (!isPaymentReady && applicationStatus === "ready_for_payment") return "revert";
  return "noop";
}

export async function evaluateApplicationReadiness(
  tx: DbTransaction,
  applicationId: string,
  now: Date = new Date()
) {
  const apps = await tx
    .select()
    .from(application)
    .where(eq(application.id, applicationId))
    .limit(1);
  const app = apps[0];

  if (!app) return;

  if (!READINESS_EVALUABLE_STATUSES.has(app.applicationStatus)) {
    return;
  }

  const partyRows = app.partyId
    ? await tx
        .select()
        .from(application)
        .where(eq(application.partyId, app.partyId))
    : [app];

  const primary = partyRows.find((r) => r.travelerRole === "primary") ?? partyRows[0]!;

  const uploads = await loadPaymentUploadPresence(tx, primary.id);

  let profileEmail = primary.guestEmail?.trim() || null;
  if (!profileEmail && primary.userId) {
    const [u] = await tx.select({ email: user.email }).from(user).where(eq(user.id, primary.userId)).limit(1);
    profileEmail = u?.email?.trim() || null;
  }

  const validation = computeValidation({
    profile: {
      email: profileEmail,
      phone: primary.phone,
      fullName: primary.fullName,
      dateOfBirth: primary.dateOfBirth,
      placeOfBirth: primary.placeOfBirth,
      nationality: primary.applicantNationality,
      passportNumber: primary.passportNumber,
      passportExpiryDate: primary.passportExpiryDate,
      profession: primary.profession,
      address: primary.address,
    },
    uploads,
    now,
  });

  const action = readinessPromotionAction(primary.applicationStatus, validation);
  const memberIds = partyRows.map((r) => r.id);

  if (action === "advance") {
    await tx
      .update(application)
      .set({ applicationStatus: "ready_for_payment" })
      .where(inArray(application.id, memberIds));
  } else if (action === "revert") {
    await tx
      .update(application)
      .set({ applicationStatus: "needs_review" })
      .where(inArray(application.id, memberIds));
  }
}
