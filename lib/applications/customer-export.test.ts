import { describe, expect, it } from "vitest";
import {
  buildCustomerExportApplicationRows,
  buildCustomerExportCsv,
  customerExportZipBasename,
  escapeCsvCell,
  formatServiceTypeForExport,
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

describe("formatServiceTypeForExport", () => {
  it("includes duration and entries when present", () => {
    expect(
      formatServiceTypeForExport({
        name: "Tourist visa",
        durationDays: 30,
        entries: "single",
      }),
    ).toBe("Tourist visa (30 days, single)");
  });

  it("returns name only when extras are absent", () => {
    expect(
      formatServiceTypeForExport({
        name: "Business visa",
        durationDays: null,
        entries: null,
      }),
    ).toBe("Business visa");
  });
});

describe("buildCustomerExportApplicationRows", () => {
  it("always includes service type and optionally price paid", () => {
    expect(
      buildCustomerExportApplicationRows({
        serviceType: "Tourist visa (30 days, single)",
      }),
    ).toEqual([{ label: "Service type", value: "Tourist visa (30 days, single)" }]);

    expect(
      buildCustomerExportApplicationRows({
        serviceType: "Tourist visa",
        pricePaid: "$419.00",
      }),
    ).toEqual([
      { label: "Service type", value: "Tourist visa" },
      { label: "Price paid", value: "$419.00" },
    ]);
  });
});

describe("buildCustomerExportCsv", () => {
  it("emits field/value header and rows", () => {
    const csv = buildCustomerExportCsv([
      { label: "Service type", value: "Tourist visa" },
      { label: "Full name", value: "Jane Doe" },
      { label: "Address", value: "Line 1\nLine 2" },
    ]);
    expect(csv).toContain("field,value");
    expect(csv).toContain("Service type,Tourist visa");
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
