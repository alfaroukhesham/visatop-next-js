import { describe, expect, it } from "vitest";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import { GENERIC_DOCUMENT_ACCEPT_HINT, PASSPORT_SLOT } from "@/lib/apply/document-slot-catalog";
import { translateDocumentSlot } from "@/lib/apply/document-slot-i18n";

describe("translateDocumentSlot", () => {
  it("translates floor passport labels", () => {
    const t = createCustomerT("fr");
    const translated = translateDocumentSlot(PASSPORT_SLOT, t);
    expect(translated.label).toBe(t("documents.slots.passportCopy.label"));
    expect(translated.label).not.toBe(PASSPORT_SLOT.label);
  });

  it("translates generic accept hints on catalog extras", () => {
    const t = createCustomerT("ar");
    const translated = translateDocumentSlot(
      {
        key: "invitation_letter",
        label: "Invitation letter",
        description: GENERIC_DOCUMENT_ACCEPT_HINT,
        role: "additional",
        acceptMime: "application/pdf",
        maxBytes: 8,
      },
      t,
    );
    expect(translated.label).toBe("Invitation letter");
    expect(translated.description).toBe(t("documents.slots.genericAcceptHint"));
  });
});
