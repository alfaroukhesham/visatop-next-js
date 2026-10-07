import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPE } from "@/lib/apply/document-type-constants";
import {
  slotForDocumentType,
  FLOOR_DOCUMENT_TYPE_KEYS,
  ASSIGNABLE_DOCUMENT_TYPE_KEYS,
} from "./document-slot-catalog";

describe("document-slot-catalog", () => {
  it("returns bank presentation for bank_statement_6m", () => {
    const slot = slotForDocumentType(DOCUMENT_TYPE.BANK_STATEMENT_6M);
    expect(slot?.key).toBe("bank_statement_6m");
    expect(slot?.label.toLowerCase()).toContain("bank");
    expect(slot?.maxBytes).toBe(8 * 1024 * 1024);
  });

  it("floor keys are passport + photo", () => {
    expect(FLOOR_DOCUMENT_TYPE_KEYS).toEqual([
      DOCUMENT_TYPE.PASSPORT_COPY,
      DOCUMENT_TYPE.PERSONAL_PHOTO,
    ]);
  });

  it("passport and photo accept HEIC stills", () => {
    const passport = slotForDocumentType(DOCUMENT_TYPE.PASSPORT_COPY);
    const photo = slotForDocumentType(DOCUMENT_TYPE.PERSONAL_PHOTO);
    expect(passport?.acceptMime).toMatch(/image\/heic/);
    expect(photo?.acceptMime).toMatch(/image\/heic/);
    expect(passport?.acceptMime).toMatch(/application\/pdf/);
    expect(photo?.acceptMime).not.toMatch(/application\/pdf/);
  });

  it("assignable extras exclude the floor", () => {
    expect(ASSIGNABLE_DOCUMENT_TYPE_KEYS).toEqual([DOCUMENT_TYPE.BANK_STATEMENT_6M]);
    expect(ASSIGNABLE_DOCUMENT_TYPE_KEYS).not.toContain(DOCUMENT_TYPE.PASSPORT_COPY);
  });
});
