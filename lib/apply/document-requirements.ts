import { DOCUMENT_TYPE } from "@/lib/db/schema/application-document";
import { requiresAfricaAsiaBankStatementNationality } from "./nationality-regions";
import { classifyServiceKind, type TServiceKind } from "./service-kind";

export type TDocSlotRole = "required" | "additional";

export type TDocumentSlotKey =
  | typeof DOCUMENT_TYPE.PASSPORT_COPY
  | typeof DOCUMENT_TYPE.PERSONAL_PHOTO
  | typeof DOCUMENT_TYPE.BANK_STATEMENT_6M;

export type TDocumentSlot = {
  key: TDocumentSlotKey;
  label: string;
  description: string;
  role: TDocSlotRole;
  acceptMime: string;
  maxBytes: number;
};

export const DOCUMENT_SLOT_MAX_BYTES = 8 * 1024 * 1024;

const PASSPORT_SLOT: TDocumentSlot = {
  key: DOCUMENT_TYPE.PASSPORT_COPY,
  label: "Passport (bio page)",
  description: "JPEG / PNG / single-page PDF · 8MB max",
  role: "required",
  acceptMime: "image/jpeg,image/png,application/pdf",
  maxBytes: DOCUMENT_SLOT_MAX_BYTES,
};

const PHOTO_SLOT: TDocumentSlot = {
  key: DOCUMENT_TYPE.PERSONAL_PHOTO,
  label: "Personal photo",
  description: "JPEG or PNG · 8MB max",
  role: "required",
  acceptMime: "image/jpeg,image/png",
  maxBytes: DOCUMENT_SLOT_MAX_BYTES,
};

const BANK_SLOT: TDocumentSlot = {
  key: DOCUMENT_TYPE.BANK_STATEMENT_6M,
  label: "Last 6 months bank account statement",
  description: "One PDF or image covering the last 6 months · JPEG / PNG / PDF · 8MB max",
  role: "required",
  acceptMime: "image/jpeg,image/png,application/pdf",
  maxBytes: DOCUMENT_SLOT_MAX_BYTES,
};

export type TResolveDocumentRequirementsInput = {
  nationalityCode: string;
  serviceName: string;
  durationDays: number | null;
  serviceKind?: TServiceKind;
};

export const resolveDocumentRequirements = (
  input: TResolveDocumentRequirementsInput,
): TDocumentSlot[] => {
  const kind = input.serviceKind ?? classifyServiceKind({
    name: input.serviceName,
    durationDays: input.durationDays,
  });
  const slots: TDocumentSlot[] = [PASSPORT_SLOT, PHOTO_SLOT];
  if (
    kind !== "transit" &&
    requiresAfricaAsiaBankStatementNationality(input.nationalityCode)
  ) {
    slots.push(BANK_SLOT);
  }
  return slots;
};

export const requiredDocumentTypeKeys = (slots: TDocumentSlot[]): TDocumentSlotKey[] =>
  slots.filter((s) => s.role === "required").map((s) => s.key);
