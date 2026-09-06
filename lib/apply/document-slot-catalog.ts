import { DOCUMENT_TYPE } from "@/lib/db/schema/application-document";

export type TDocSlotRole = "required" | "additional";

export type TDocumentSlotKey =
  | typeof DOCUMENT_TYPE.PASSPORT_COPY
  | typeof DOCUMENT_TYPE.PERSONAL_PHOTO
  | typeof DOCUMENT_TYPE.BANK_STATEMENT_6M;

export type TDocumentSlot = {
  key: string;
  label: string;
  description: string;
  role: TDocSlotRole;
  acceptMime: string;
  maxBytes: number;
};

export const DOCUMENT_SLOT_MAX_BYTES = 8 * 1024 * 1024;

export const PASSPORT_SLOT: TDocumentSlot = {
  key: DOCUMENT_TYPE.PASSPORT_COPY,
  label: "Passport (bio page)",
  description: "JPEG / PNG / single-page PDF · 8MB max",
  role: "required",
  acceptMime: "image/jpeg,image/png,application/pdf",
  maxBytes: DOCUMENT_SLOT_MAX_BYTES,
};

export const PHOTO_SLOT: TDocumentSlot = {
  key: DOCUMENT_TYPE.PERSONAL_PHOTO,
  label: "Personal photo",
  description: "JPEG or PNG · 8MB max",
  role: "required",
  acceptMime: "image/jpeg,image/png",
  maxBytes: DOCUMENT_SLOT_MAX_BYTES,
};

export const BANK_SLOT: TDocumentSlot = {
  key: DOCUMENT_TYPE.BANK_STATEMENT_6M,
  label: "Last 6 months bank account statement",
  description: "One PDF or image covering the last 6 months · JPEG / PNG / PDF · 8MB max",
  role: "required",
  acceptMime: "image/jpeg,image/png,application/pdf",
  maxBytes: DOCUMENT_SLOT_MAX_BYTES,
};

const SLOT_BY_KEY: Record<string, TDocumentSlot> = {
  [DOCUMENT_TYPE.PASSPORT_COPY]: PASSPORT_SLOT,
  [DOCUMENT_TYPE.PERSONAL_PHOTO]: PHOTO_SLOT,
  [DOCUMENT_TYPE.BANK_STATEMENT_6M]: BANK_SLOT,
};

export const slotForDocumentType = (key: string): TDocumentSlot | null =>
  SLOT_BY_KEY[key] ?? null;

export const FLOOR_DOCUMENT_TYPE_KEYS = [
  DOCUMENT_TYPE.PASSPORT_COPY,
  DOCUMENT_TYPE.PERSONAL_PHOTO,
] as const;

export const ASSIGNABLE_DOCUMENT_TYPE_KEYS = [
  DOCUMENT_TYPE.BANK_STATEMENT_6M,
] as const;
