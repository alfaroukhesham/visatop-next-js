import { describe, expect, it } from "vitest";
import { customerUploadStateLabel } from "./customer-upload-copy";

describe("customerUploadStateLabel", () => {
  it("returns Uploaded when a document exists", () => {
    expect(customerUploadStateLabel(true)).toBe("Uploaded");
  });

  it("returns Not uploaded yet when no document exists", () => {
    expect(customerUploadStateLabel(false)).toBe("Not uploaded yet");
  });

  it("never mentions bytes or filenames", () => {
    const labels = [customerUploadStateLabel(true), customerUploadStateLabel(false)];
    for (const label of labels) {
      expect(label).not.toMatch(/byte|kb|filename|original/i);
    }
  });
});
