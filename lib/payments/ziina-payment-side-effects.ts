import { after } from "next/server";
import { sendPaymentReceivedInProgressEmail } from "@/lib/email/send-application-transactional-emails";
import { sendAdminPaymentCompletedEmail } from "@/lib/email/send-admin-notification-emails";
import { createRequestLogger } from "@/lib/logger";

export function scheduleZiinaPaidSideEffects(applicationId: string, requestId?: string | null): void {
  const rid = requestId ?? null;
  after(() => {
    const log = createRequestLogger(rid);
    void sendPaymentReceivedInProgressEmail(applicationId, rid).catch((err) => {
      log.error({ err, applicationId }, "[ziina-payments] payment_received_in_progress email failed");
    });
    void sendAdminPaymentCompletedEmail(applicationId, rid).catch((err) => {
      log.error({ err, applicationId }, "[ziina-payments] admin_payment_completed email failed");
    });
  });
}
