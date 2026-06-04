import { and, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  applicationDocument,
  DOCUMENT_STATUS,
  DOCUMENT_TYPE,
} from "@/lib/db/schema";

export async function loadPaymentUploadFlags(
  tx: DbTransaction,
  applicationId: string,
): Promise<{ passportCopyPresent: boolean; personalPhotoPresent: boolean }> {
  const uploads = await tx
    .select({ documentType: applicationDocument.documentType })
    .from(applicationDocument)
    .where(
      and(
        eq(applicationDocument.applicationId, applicationId),
        eq(applicationDocument.status, DOCUMENT_STATUS.UPLOADED_TEMP),
      ),
    );

  return {
    passportCopyPresent: uploads.some((u) => u.documentType === DOCUMENT_TYPE.PASSPORT_COPY),
    personalPhotoPresent: uploads.some((u) => u.documentType === DOCUMENT_TYPE.PERSONAL_PHOTO),
  };
}
