import { describe, expect, it } from "vitest";
import {
  mapDocumentRequirementRows,
  type TRawDocumentRequirementRow,
} from "./load-document-requirement-rows";
import {
  requiredDocumentTypeKeys,
  resolveDocumentRequirements,
} from "@/lib/apply/document-requirements";

describe("mapDocumentRequirementRows", () => {
  it("maps role and documentType", () => {
    const rows: TRawDocumentRequirementRow[] = [
      { documentType: "bank_statement_6m", role: "required" },
    ];
    expect(mapDocumentRequirementRows(rows)).toEqual([
      { documentType: "bank_statement_6m", role: "required" },
    ]);
  });

  it("includes catalog type metadata when present", () => {
    const rows: TRawDocumentRequirementRow[] = [
      {
        documentType: "invitation_letter",
        role: "required",
        label: "Invitation letter",
        description: "Signed PDF",
        acceptMime: "application/pdf",
      },
    ];
    expect(mapDocumentRequirementRows(rows)).toEqual([
      {
        documentType: "invitation_letter",
        role: "required",
        label: "Invitation letter",
        description: "Signed PDF",
        acceptMime: "application/pdf",
      },
    ]);
  });

  it("omits optionals when type row is missing (null metadata)", () => {
    const rows: TRawDocumentRequirementRow[] = [
      {
        documentType: "custom_doc",
        role: "additional",
        label: null,
        description: null,
        acceptMime: null,
      },
    ];
    expect(mapDocumentRequirementRows(rows)).toEqual([
      { documentType: "custom_doc", role: "additional" },
    ]);
  });
});

describe("requirement rows → required keys (checkout/draft parity)", () => {
  it("includes floor plus required extras when catalog rows exist", () => {
    const mapped = mapDocumentRequirementRows([
      { documentType: "bank_statement_6m", role: "required" },
    ]);
    const slots = resolveDocumentRequirements(mapped);
    expect(requiredDocumentTypeKeys(slots)).toEqual([
      "passport_copy",
      "personal_photo",
      "bank_statement_6m",
    ]);
  });

  it("floor only when no requirement rows", () => {
    expect(requiredDocumentTypeKeys(resolveDocumentRequirements([]))).toEqual([
      "passport_copy",
      "personal_photo",
    ]);
  });
});
