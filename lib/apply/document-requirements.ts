import {
  slotForDocumentType,
  FLOOR_DOCUMENT_TYPE_KEYS,
  type TDocumentSlot,
  type TDocSlotRole,
  type TDocumentSlotKey,
} from "./document-slot-catalog";

export type { TDocumentSlot, TDocSlotRole, TDocumentSlotKey };

export type TRequirementRow = {
  documentType: string;
  role: "required" | "additional";
};

export const resolveDocumentRequirements = (rows: TRequirementRow[]): TDocumentSlot[] => {
  const extras = rows
    .filter((r) => !FLOOR_DOCUMENT_TYPE_KEYS.includes(r.documentType as never))
    .map((r) => {
      const slot = slotForDocumentType(r.documentType);
      if (!slot) return null;
      return { ...slot, role: r.role };
    })
    .filter((s): s is TDocumentSlot => s !== null);
  const floor = FLOOR_DOCUMENT_TYPE_KEYS.map((k) => slotForDocumentType(k)!);
  return [...floor, ...extras];
};

export const requiredDocumentTypeKeys = (slots: TDocumentSlot[]): TDocumentSlotKey[] =>
  slots.filter((s) => s.role === "required").map((s) => s.key);
