import type { PublicApplication } from "@/lib/applications/public-application";
import { computeValidation } from "@/lib/documents/validation-readiness";

export function paymentPanelMayShow(
  app: Pick<PublicApplication, "paymentStatus" | "isGuest" | "guestEmail" | "applicant">,
  uploads: { passportCopyPresent: boolean; personalPhotoPresent: boolean },
): boolean {
  if (app.paymentStatus === "checkout_created" || app.paymentStatus === "paid") {
    return true;
  }
  const validationEmail = app.isGuest ? app.guestEmail : "signed-in";
  return (
    computeValidation({
      profile: { ...app.applicant, email: validationEmail },
      uploads,
      now: new Date(),
    }).paymentReadiness === "ready"
  );
}
