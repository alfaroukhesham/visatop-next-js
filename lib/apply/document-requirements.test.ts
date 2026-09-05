import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPE } from "@/lib/db/schema/application-document";
import { resolveDocumentRequirements, requiredDocumentTypeKeys } from "./document-requirements";

const tourist30 = { serviceName: "30 Days Tourist", durationDays: 30 };
const transit48 = { serviceName: "48 Hours Transit Visa", durationDays: 2 };

describe("resolveDocumentRequirements", () => {
  it("India + 30-day tourist includes bank statement", () => {
    const keys = requiredDocumentTypeKeys(resolveDocumentRequirements({ nationalityCode: "IN", ...tourist30 }));
    expect(keys).toEqual([
      DOCUMENT_TYPE.PASSPORT_COPY,
      DOCUMENT_TYPE.PERSONAL_PHOTO,
      DOCUMENT_TYPE.BANK_STATEMENT_6M,
    ]);
  });

  it("Nigeria + 30-day tourist includes bank statement", () => {
    const keys = requiredDocumentTypeKeys(resolveDocumentRequirements({ nationalityCode: "NG", ...tourist30 }));
    expect(keys).toContain(DOCUMENT_TYPE.BANK_STATEMENT_6M);
  });

  it("France + 30-day tourist has no bank statement", () => {
    const keys = requiredDocumentTypeKeys(resolveDocumentRequirements({ nationalityCode: "FR", ...tourist30 }));
    expect(keys).toEqual([DOCUMENT_TYPE.PASSPORT_COPY, DOCUMENT_TYPE.PERSONAL_PHOTO]);
  });

  it("India + transit has no bank statement", () => {
    const keys = requiredDocumentTypeKeys(resolveDocumentRequirements({ nationalityCode: "IN", ...transit48 }));
    expect(keys).not.toContain(DOCUMENT_TYPE.BANK_STATEMENT_6M);
  });

  it("Nigeria + transit has no bank statement", () => {
    const keys = requiredDocumentTypeKeys(resolveDocumentRequirements({ nationalityCode: "NG", ...transit48 }));
    expect(keys).not.toContain(DOCUMENT_TYPE.BANK_STATEMENT_6M);
  });

  it("India + 5-year tourist includes bank statement", () => {
    const keys = requiredDocumentTypeKeys(
      resolveDocumentRequirements({
        nationalityCode: "IN",
        serviceName: "5 Years Multiple Entry",
        durationDays: 1825,
      }),
    );
    expect(keys).toContain(DOCUMENT_TYPE.BANK_STATEMENT_6M);
  });
});
