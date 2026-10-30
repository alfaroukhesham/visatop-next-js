import { after } from "next/server";
import { sendPaymentReceivedInProgressEmail } from "@/lib/email/send-application-transactional-emails";
import { sendAdminPaymentCompletedEmail } from "@/lib/email/send-admin-notification-emails";
import { sendMetaCapiPurchase } from "@/lib/payments/meta-capi";
import { createRequestLogger } from "@/lib/logger";

export const scheduleFincraPaidSideEffects = (applicationId: string, requestId?: string | null): void => {
  const rid = requestId ?? null;
  after(() => {
    const log = createRequestLogger(rid);
    void sendPaymentReceivedInProgressEmail(applicationId, rid).catch((err) => {
      log.error({ err, applicationId }, "[fincra-payments] payment_received_in_progress email failed");
    });
    void sendAdminPaymentCompletedEmail(applicationId, rid).catch((err) => {
      log.error({ err, applicationId }, "[fincra-payments] admin_payment_completed email failed");
    });
    void sendMetaCapiPurchase(applicationId, rid).catch((err) => {
      log.error({ err, applicationId }, "[fincra-payments] meta_capi_purchase failed");
    });
  });
};
