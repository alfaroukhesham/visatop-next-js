import type { TCustomerMessageVars } from "@/lib/i18n/customer-messages";
import type { TDocumentSlot } from "@/lib/apply/document-slot-catalog";
import { GENERIC_DOCUMENT_ACCEPT_HINT } from "@/lib/apply/document-slot-catalog";

type TTranslate = (key: string, vars?: TCustomerMessageVars) => string;

const SLOT_MESSAGE_KEYS: Record<string, { label: string; description: string }> = {
  passport_copy: {
    label: "documents.slots.passportCopy.label",
    description: "documents.slots.passportCopy.description",
  },
  personal_photo: {
    label: "documents.slots.personalPhoto.label",
    description: "documents.slots.personalPhoto.description",
  },
  bank_statement_6m: {
    label: "documents.slots.bankStatement6m.label",
    description: "documents.slots.bankStatement6m.description",
  },
};

export const translateDocumentSlot = (slot: TDocumentSlot, t: TTranslate): TDocumentSlot => {
  const keys = SLOT_MESSAGE_KEYS[slot.key];
  if (keys) {
    return { ...slot, label: t(keys.label), description: t(keys.description) };
  }
  if (slot.description === GENERIC_DOCUMENT_ACCEPT_HINT) {
    return { ...slot, description: t("documents.slots.genericAcceptHint") };
  }
  return slot;
};
