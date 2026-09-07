import type { DbTransaction } from "@/lib/db";
import { loadPaymentUploadPresence } from "@/lib/applications/load-payment-upload-presence";

export async function loadPaymentUploadFlags(
  tx: DbTransaction,
  applicationId: string,
): Promise<{ passportCopyPresent: boolean; personalPhotoPresent: boolean }> {
  const presence = await loadPaymentUploadPresence(tx, applicationId);
  return {
    passportCopyPresent: presence.passportCopyPresent,
    personalPhotoPresent: presence.personalPhotoPresent,
  };
}
