import { and, asc, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  application,
  applicationDocument,
  catalogDocumentRequirement,
  DOCUMENT_STATUS,
} from "@/lib/db/schema";
import { resolveDocumentRequirements } from "@/lib/apply/document-requirements";
import { buildUploadPresence, type TMemberUploadState } from "@/lib/apply/payment-upload-presence";
import type { UploadPresence } from "@/lib/documents/validation-readiness";

const loadMemberUploadState = async (
  tx: DbTransaction,
  member: { id: string; serviceId: string; nationalityCode: string },
): Promise<TMemberUploadState> => {
  const [requirementRows, uploads] = await Promise.all([
    tx
      .select({
        documentType: catalogDocumentRequirement.documentType,
        role: catalogDocumentRequirement.role,
      })
      .from(catalogDocumentRequirement)
      .where(
        and(
          eq(catalogDocumentRequirement.serviceId, member.serviceId),
          eq(catalogDocumentRequirement.nationalityCode, member.nationalityCode),
        ),
      ),
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

  const slots = resolveDocumentRequirements(
    requirementRows.map((r) => ({
      documentType: r.documentType,
      role: r.role as "required" | "additional",
    })),
  );
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
