import { after } from "next/server";
import { sendPaymentReceivedInProgressEmail } from "@/lib/email/send-application-transactional-emails";
import { sendAdminPaymentCompletedEmail } from "@/lib/email/send-admin-notification-emails";

export function scheduleZiinaPaidSideEffects(applicationId: string, requestId?: string | null): void {
  const rid = requestId ?? null;
  after(() => {
    void sendPaymentReceivedInProgressEmail(applicationId, rid).catch((err) => {
      console.error("[ziina-payments] payment_received_in_progress email failed", {
        applicationId,
        requestId,
        err: err instanceof Error ? err.message : err,
      });
    });
    void sendAdminPaymentCompletedEmail(applicationId, rid).catch((err) => {
      console.error("[ziina-payments] admin_payment_completed email failed", {
        applicationId,
        requestId,
        err: err instanceof Error ? err.message : err,
      });
    });
  });
}
