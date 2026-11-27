import { describe, expect, it } from "vitest";
import {
  buildCustomerExportApplicationRows,
  buildCustomerExportCsv,
  buildCustomerExportTripRows,
  customerExportTripFlags,
  customerExportZipBasename,
  escapeCsvCell,
  formatServiceTypeForExport,
  zipEntryNameForDocument,
  zipEntryNamesForDocuments,
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

describe("customerExportTripFlags", () => {
  it("reads insurance from the traveller selection and fast track from speed or selection", () => {
    expect(
      customerExportTripFlags({
        processingSpeed: "standard",
        extras: [
          { key: "travel_insurance", selected: true },
          { key: "fast_track", selected: false },
        ],
      }),
    ).toEqual({ insuranceSelected: true, fastTrackSelected: false });

    expect(
      customerExportTripFlags({
        processingSpeed: "fast_track",
        extras: [],
      }),
    ).toEqual({ insuranceSelected: false, fastTrackSelected: true });

    expect(
      customerExportTripFlags({
        processingSpeed: null,
        extras: [{ key: "fast_track", selected: true }],
      }),
    ).toEqual({ insuranceSelected: false, fastTrackSelected: true });
  });
});

describe("buildCustomerExportTripRows", () => {
  it("writes flight date and Y/N extras", () => {
    expect(
      buildCustomerExportTripRows({
        travelDate: "2026-12-20",
        insuranceSelected: true,
        fastTrackSelected: false,
      }),
    ).toEqual([
      { label: "Flight date", value: "20-12-2026" },
      { label: "Insurance", value: "Y" },
      { label: "Fast track", value: "N" },
    ]);
  });

  it("leaves flight date blank when the party has none", () => {
    expect(
      buildCustomerExportTripRows({
        travelDate: null,
        insuranceSelected: false,
        fastTrackSelected: false,
      }),
    ).toEqual([
      { label: "Flight date", value: "" },
      { label: "Insurance", value: "N" },
      { label: "Fast track", value: "N" },
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

  it("names a stored JPEG with .jpg when the upload was a PDF", () => {
    const doc: CustomerExportDocument = {
      id: "doc-1",
      documentType: "passport_copy",
      status: "retained",
      contentType: "image/jpeg",
      originalFilename: "passport.pdf",
      createdAt: new Date(),
      bytes: Buffer.from("x"),
    };
    expect(zipEntryNameForDocument(doc)).toBe("documents/passport_copy-passport.jpg");
  });

  it("keeps .pdf when the stored bytes are a PDF", () => {
    const doc: CustomerExportDocument = {
      id: "doc-2",
      documentType: "bank_statement_6m",
      status: "retained",
      contentType: "application/pdf",
      originalFilename: "statement.pdf",
      createdAt: new Date(),
      bytes: Buffer.from("x"),
    };
    expect(zipEntryNameForDocument(doc)).toBe("documents/bank_statement_6m-statement.pdf");
  });
});

const exportDoc = (overrides: Partial<CustomerExportDocument>): CustomerExportDocument => ({
  id: "doc-1",
  documentType: "supporting",
  status: "retained",
  contentType: "image/jpeg",
  originalFilename: "notes.pdf",
  createdAt: new Date(),
  bytes: Buffer.from("x"),
  ...overrides,
});

describe("zipEntryNamesForDocuments", () => {
  it("keeps both supporting files when rewritten names would match", () => {
    const names = zipEntryNamesForDocuments([
      exportDoc({ id: "a", originalFilename: "2-notes.pdf", contentType: "image/jpeg" }),
      exportDoc({ id: "b", originalFilename: "notes.jpg", contentType: "image/jpeg" }),
    ]);
    expect(names).toEqual([
      "documents/supporting-2-notes.jpg",
      "documents/supporting-2-notes-2.jpg",
    ]);
    expect(new Set(names).size).toBe(names.length);
  });
});
