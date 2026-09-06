import {
  isReservedDocumentTypeKey,
  humanizeDocumentTypeKey,
} from "@/lib/admin/catalog/document-type";
import {
  slotForDocumentType,
  FLOOR_DOCUMENT_TYPE_KEYS,
  DOCUMENT_SLOT_MAX_BYTES,
  type TDocumentSlot,
  type TDocSlotRole,
  type TDocumentSlotKey,
} from "./document-slot-catalog";

export type { TDocumentSlot, TDocSlotRole, TDocumentSlotKey };

export type TRequirementRow = {
  documentType: string;
  role: "required" | "additional";
  label?: string;
  description?: string;
  acceptMime?: string;
};

const extraSlot = (row: TRequirementRow): TDocumentSlot => {
  const known = slotForDocumentType(row.documentType);
  if (known) return { ...known, role: row.role };
  return {
    key: row.documentType,
    label: row.label ?? humanizeDocumentTypeKey(row.documentType),
    description: row.description || "JPEG / PNG / PDF · 8MB max",
    role: row.role,
    acceptMime: row.acceptMime ?? "image/jpeg,image/png,application/pdf",
    maxBytes: DOCUMENT_SLOT_MAX_BYTES,
  };
};

export const resolveDocumentRequirements = (rows: TRequirementRow[]): TDocumentSlot[] => {
  const extras = rows
    .filter((r) => !isReservedDocumentTypeKey(r.documentType))
    .map(extraSlot);
  const floor = FLOOR_DOCUMENT_TYPE_KEYS.map((k) => slotForDocumentType(k)!);
  return [...floor, ...extras];
};

export const requiredDocumentTypeKeys = (slots: TDocumentSlot[]): string[] =>
  slots.filter((s) => s.role === "required").map((s) => s.key);
