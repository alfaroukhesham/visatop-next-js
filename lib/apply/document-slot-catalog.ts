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

/** Fallback accept hint for catalog extras without a custom description. */
export const GENERIC_DOCUMENT_ACCEPT_HINT = "JPEG / PNG / PDF · 8MB max";

export const HEIC_ACCEPT_MIME = "image/heic,image/heif,.heic,.heif";
export const PASSPORT_ACCEPT_MIME = `image/jpeg,image/png,${HEIC_ACCEPT_MIME},application/pdf`;
export const PHOTO_ACCEPT_MIME = `image/jpeg,image/png,${HEIC_ACCEPT_MIME}`;

export const PASSPORT_SLOT: TDocumentSlot = {
  key: DOCUMENT_TYPE.PASSPORT_COPY,
  label: "Passport (bio page)",
  description: "JPEG, PNG, HEIC, or single-page PDF · 8MB max",
  role: "required",
  acceptMime: PASSPORT_ACCEPT_MIME,
  maxBytes: DOCUMENT_SLOT_MAX_BYTES,
};

export const PHOTO_SLOT: TDocumentSlot = {
  key: DOCUMENT_TYPE.PERSONAL_PHOTO,
  label: "Personal photo",
  description: "JPEG, PNG, or HEIC · 8MB max",
  role: "required",
  acceptMime: PHOTO_ACCEPT_MIME,
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
