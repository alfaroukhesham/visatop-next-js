import { DOCUMENT_TYPE } from "@/lib/db/schema/application-document";
import type { UploadPresence } from "@/lib/documents/validation-readiness";
import {
  requiredDocumentTypeKeys,
  type TDocumentSlot,
} from "@/lib/apply/document-requirements";

export type TMemberUploadState = {
  slots: TDocumentSlot[];
  uploadedTypes: string[];
};

/** Draft/API docs may have `status: string | null`; treat anything but `"deleted"` as present. */
type TSlotDoc = { status?: string | null } | null;

export const uploadedTypesFromSlotDocs = (
  docsByType: Partial<Record<string, TSlotDoc>>,
  slotKeys: string[],
): string[] =>
  slotKeys.filter((k) => {
    const doc = docsByType[k];
    return doc != null && doc.status !== "deleted";
  });

export const memberUploadStateFromDraft = (
  slots: TDocumentSlot[],
  docsByType: Partial<Record<string, TSlotDoc>>,
): TMemberUploadState => ({
  slots,
  uploadedTypes: uploadedTypesFromSlotDocs(
    docsByType,
    slots.map((s) => s.key),
  ),
});

export const buildUploadPresence = (members: TMemberUploadState[]): UploadPresence => {
  const memberRequiredUploads = members.map((m) => ({
    requiredSlotKeys: requiredDocumentTypeKeys(m.slots),
    uploadedDocumentTypes: m.uploadedTypes,
  }));
  const allUploaded = new Set(members.flatMap((m) => m.uploadedTypes));
  return {
    passportCopyPresent: allUploaded.has(DOCUMENT_TYPE.PASSPORT_COPY),
    personalPhotoPresent: allUploaded.has(DOCUMENT_TYPE.PERSONAL_PHOTO),
    memberRequiredUploads,
  };
};
