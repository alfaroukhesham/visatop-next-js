import { describe, expect, it } from "vitest";
import {
  customerUploadErrorMessage,
  customerUploadStateLabel,
  oversizedUploadMessage,
} from "./customer-upload-copy";

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

describe("oversizedUploadMessage", () => {
  const maxBytes = 8 * 1024 * 1024;

  it("returns a customer message when the file is over the limit", () => {
    expect(oversizedUploadMessage(maxBytes + 1, maxBytes)).toBe("File exceeds 8MB limit.");
  });

  it("returns null when the file is within the limit", () => {
    expect(oversizedUploadMessage(maxBytes, maxBytes)).toBeNull();
    expect(oversizedUploadMessage(0, maxBytes)).toBeNull();
  });
});

describe("customerUploadErrorMessage", () => {
  it("maps known codes to localised copy", () => {
    expect(customerUploadErrorMessage("CORRUPT_IMAGE")).toMatch(/couldn't read/i);
    expect(customerUploadErrorMessage("TIMEOUT")).toMatch(/Wi-Fi/i);
    expect(customerUploadErrorMessage("UNSUPPORTED_TYPE")).toMatch(/HEIC/i);
  });

  it("falls back for unknown codes", () => {
    expect(customerUploadErrorMessage("SOMETHING_ELSE")).toBe("Upload failed. Please try again.");
  });
});
