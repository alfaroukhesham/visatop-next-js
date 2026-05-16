import { describe, expect, it } from "vitest";
import {
  buildCustomerExportCsv,
  customerExportZipBasename,
  escapeCsvCell,
  zipEntryNameForDocument,
  type CustomerExportDocument,
} from "./customer-export";

describe("escapeCsvCell", () => {
  it("quotes values with commas or newlines", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });
});

describe("buildCustomerExportCsv", () => {
  it("emits field/value header and rows", () => {
    const csv = buildCustomerExportCsv([
      { label: "Full name", value: "Jane Doe" },
      { label: "Address", value: "Line 1\nLine 2" },
    ]);
    expect(csv).toContain("field,value");
    expect(csv).toContain("Full name,Jane Doe");
    expect(csv).toContain('"Line 1\nLine 2"');
  });
});

describe("customerExportZipBasename", () => {
  it("uses reference number when present", () => {
    expect(customerExportZipBasename("REF-001", "uuid-1234")).toBe("REF-001-customer-export");
  });

  it("falls back to application id prefix", () => {
    expect(customerExportZipBasename(null, "abcdef12-3456")).toBe("abcdef12-customer-export");
  });
});

describe("zipEntryNameForDocument", () => {
  it("places files under documents/ with type prefix", () => {
    const doc: CustomerExportDocument = {
      id: "doc-1",
      documentType: "passport_copy",
      status: "retained",
      contentType: "image/jpeg",
      originalFilename: "scan.jpg",
      createdAt: new Date(),
      bytes: Buffer.from("x"),
    };
    expect(zipEntryNameForDocument(doc)).toBe("documents/passport_copy-scan.jpg");
  });
});
