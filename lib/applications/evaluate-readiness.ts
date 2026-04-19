import { eq, and } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, applicationDocument, DOCUMENT_STATUS, DOCUMENT_TYPE } from "@/lib/db/schema";
import { computeValidation } from "@/lib/documents/validation-readiness";

/**
 * Re-evaluates application readiness and auto-advances the applicationStatus.
 *
 * If readiness === "ready" and status is "needs_review", transitions to "ready_for_payment".
 * If readiness !== "ready" and status is "ready_for_payment", reverts to "needs_review".
 */
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

  // Only auto-transition if in the review/payment phases.
  // Ignore drafts, completed, cancelled, etc.
  if (app.applicationStatus !== "needs_review" && app.applicationStatus !== "ready_for_payment") {
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

  const validation = computeValidation({
    profile: {
      email: app.guestEmail,
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

  const isReady = validation.readiness === "ready";

  if (isReady && app.applicationStatus === "needs_review") {
    await tx
      .update(application)
      .set({ applicationStatus: "ready_for_payment" })
      .where(eq(application.id, applicationId));
  } else if (!isReady && app.applicationStatus === "ready_for_payment") {
    await tx
      .update(application)
      .set({ applicationStatus: "needs_review" })
      .where(eq(application.id, applicationId));
  }
}
