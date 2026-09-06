import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPE } from "@/lib/db/schema/application-document";
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

  it("assignable extras exclude the floor", () => {
    expect(ASSIGNABLE_DOCUMENT_TYPE_KEYS).toEqual([DOCUMENT_TYPE.BANK_STATEMENT_6M]);
    expect(ASSIGNABLE_DOCUMENT_TYPE_KEYS).not.toContain(DOCUMENT_TYPE.PASSPORT_COPY);
  });
});
