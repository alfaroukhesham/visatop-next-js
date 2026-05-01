import { eq, and } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  application,
  applicationDocument,
  DOCUMENT_STATUS,
  DOCUMENT_TYPE,
  user,
} from "@/lib/db/schema";
import type { ValidationResult } from "@/lib/documents/validation-readiness";
import { computeValidation } from "@/lib/documents/validation-readiness";

/**
 * Re-evaluates application readiness and auto-advances the applicationStatus.
 *
 * When **`paymentReadiness` is `ready`** (profile + validation; uploads optional for this gate):
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

  const uploads = await tx
    .select({ documentType: applicationDocument.documentType })
    .from(applicationDocument)
    .where(
      and(
        eq(applicationDocument.applicationId, applicationId),
        eq(applicationDocument.status, DOCUMENT_STATUS.UPLOADED_TEMP)
      )
    );

  const hasPassport = uploads.some((u) => u.documentType === DOCUMENT_TYPE.PASSPORT_COPY);
  const hasPhoto = uploads.some((u) => u.documentType === DOCUMENT_TYPE.PERSONAL_PHOTO);

  let profileEmail = app.guestEmail?.trim() || null;
  if (!profileEmail && app.userId) {
    const [u] = await tx.select({ email: user.email }).from(user).where(eq(user.id, app.userId)).limit(1);
    profileEmail = u?.email?.trim() || null;
  }

  const validation = computeValidation({
    profile: {
      email: profileEmail,
      phone: app.phone,
      fullName: app.fullName,
      dateOfBirth: app.dateOfBirth,
      placeOfBirth: app.placeOfBirth,
      nationality: app.applicantNationality,
      passportNumber: app.passportNumber,
      passportExpiryDate: app.passportExpiryDate,
      profession: app.profession,
      address: app.address,
    },
    uploads: {
      passportCopyPresent: hasPassport,
      personalPhotoPresent: hasPhoto,
    },
    now,
  });

  const action = readinessPromotionAction(app.applicationStatus, validation);

  if (action === "advance") {
    await tx
      .update(application)
      .set({ applicationStatus: "ready_for_payment" })
      .where(eq(application.id, applicationId));
  } else if (action === "revert") {
    await tx
      .update(application)
      .set({ applicationStatus: "needs_review" })
      .where(eq(application.id, applicationId));
  }
}
