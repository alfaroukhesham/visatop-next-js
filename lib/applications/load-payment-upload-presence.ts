import { and, asc, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, applicationDocument, DOCUMENT_STATUS } from "@/lib/db/schema";
import { loadMemberDocumentSlots } from "@/lib/applications/load-document-requirement-rows";
import { buildUploadPresence, type TMemberUploadState } from "@/lib/apply/payment-upload-presence";
import type { UploadPresence } from "@/lib/documents/validation-readiness";

const loadMemberUploadState = async (
  tx: DbTransaction,
  member: { id: string; serviceId: string; nationalityCode: string },
): Promise<TMemberUploadState> => {
  const [slots, uploads] = await Promise.all([
    loadMemberDocumentSlots(tx, {
      serviceId: member.serviceId,
      nationalityCode: member.nationalityCode,
    }),
    tx
      .select({ documentType: applicationDocument.documentType })
      .from(applicationDocument)
      .where(
        and(
          eq(applicationDocument.applicationId, member.id),
          eq(applicationDocument.status, DOCUMENT_STATUS.UPLOADED_TEMP),
        ),
      ),
  ]);
  const uploadedTypes = uploads
    .map((u) => u.documentType)
    .filter((t): t is string => t != null);
  return { slots, uploadedTypes };
};

export const loadPaymentUploadPresence = async (
  tx: DbTransaction,
  applicationId: string,
): Promise<UploadPresence> => {
  const [app] = await tx
    .select({
      id: application.id,
      partyId: application.partyId,
      serviceId: application.serviceId,
      nationalityCode: application.nationalityCode,
    })
    .from(application)
    .where(eq(application.id, applicationId))
    .limit(1);

  if (!app) {
    return { passportCopyPresent: false, personalPhotoPresent: false };
  }

  const memberApps = app.partyId
    ? await tx
        .select({
          id: application.id,
          serviceId: application.serviceId,
          nationalityCode: application.nationalityCode,
        })
        .from(application)
        .where(eq(application.partyId, app.partyId))
        .orderBy(asc(application.travelerIndex))
    : [
        {
          id: app.id,
          serviceId: app.serviceId,
          nationalityCode: app.nationalityCode,
        },
      ];

  const memberStates = await Promise.all(memberApps.map((m) => loadMemberUploadState(tx, m)));
  return buildUploadPresence(memberStates);
};
