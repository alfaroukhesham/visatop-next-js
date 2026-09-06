import { describe, expect, it } from "vitest";
import { resolveDocumentRequirements, requiredDocumentTypeKeys } from "./document-requirements";

describe("resolveDocumentRequirements", () => {
  it("always includes passport and photo", () => {
    expect(requiredDocumentTypeKeys(resolveDocumentRequirements([]))).toEqual([
      "passport_copy",
      "personal_photo",
    ]);
  });

  it("appends a required bank extra", () => {
    const slots = resolveDocumentRequirements([
      { documentType: "bank_statement_6m", role: "required" },
    ]);
    expect(slots.map((s) => s.key)).toEqual([
      "passport_copy",
      "personal_photo",
      "bank_statement_6m",
    ]);
    expect(slots.find((s) => s.key === "bank_statement_6m")?.role).toBe("required");
  });

  it("appends an additional bank extra without dropping the floor", () => {
    const slots = resolveDocumentRequirements([
      { documentType: "bank_statement_6m", role: "additional" },
    ]);
    expect(slots.filter((s) => s.role === "additional").map((s) => s.key)).toEqual([
      "bank_statement_6m",
    ]);
    expect(requiredDocumentTypeKeys(slots)).toEqual(["passport_copy", "personal_photo"]);
  });

  it("appends admin-created extras and ignores floor keys in extras", () => {
    const slots = resolveDocumentRequirements([
      { documentType: "invitation_letter", role: "required", label: "Invitation letter" },
      { documentType: "passport_copy", role: "additional" },
    ]);
    expect(slots.map((s) => s.key)).toEqual([
      "passport_copy",
      "personal_photo",
      "invitation_letter",
    ]);
    expect(slots.find((s) => s.key === "invitation_letter")?.label).toBe("Invitation letter");
  });
});
