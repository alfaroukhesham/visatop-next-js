import { describe, expect, it } from "vitest";
import { PASSPORT_SLOT, PHOTO_SLOT } from "./document-slot-catalog";
import { memberUploadStateFromDraft, uploadedTypesFromSlotDocs } from "./payment-upload-presence";

describe("uploadedTypesFromSlotDocs", () => {
  it("counts a document with null status as uploaded", () => {
    expect(
      uploadedTypesFromSlotDocs({ passport_copy: { status: null } }, ["passport_copy"]),
    ).toEqual(["passport_copy"]);
  });

  it("skips deleted documents", () => {
    expect(
      uploadedTypesFromSlotDocs({ passport_copy: { status: "deleted" } }, ["passport_copy"]),
    ).toEqual([]);
  });
});

describe("memberUploadStateFromDraft", () => {
  it("accepts PublicDocument-shaped rows whose status is string | null", () => {
    const docsByType: Partial<Record<string, { status: string | null } | null>> = {
      passport_copy: { status: null },
      personal_photo: { status: "uploaded_temp" },
    };
    const state = memberUploadStateFromDraft([PASSPORT_SLOT, PHOTO_SLOT], docsByType);
    expect(state.uploadedTypes).toEqual(["passport_copy", "personal_photo"]);
  });
});
