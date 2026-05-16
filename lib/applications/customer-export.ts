import JSZip from "jszip";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  application,
  applicationDocument,
  applicationDocumentBlob,
  DOCUMENT_STATUS,
  DOCUMENT_TYPE,
  type DocumentType,
} from "@/lib/db/schema";
import { formatIsoDateAsDdMmYyyy } from "@/lib/documents/validation-readiness";
import { asciiFilename } from "@/lib/applications/document-fetch";

/** Document types the customer may upload on the apply flow (step 3). */
export const CUSTOMER_UPLOAD_DOCUMENT_TYPES = [
  DOCUMENT_TYPE.PASSPORT_COPY,
  DOCUMENT_TYPE.PERSONAL_PHOTO,
  DOCUMENT_TYPE.SUPPORTING,
] as const satisfies readonly DocumentType[];

const EXPORTABLE_DOC_STATUSES = [
  DOCUMENT_STATUS.UPLOADED_TEMP,
  DOCUMENT_STATUS.RETAINED,
] as const;

export type CustomerExportProfileRow = {
  label: string;
  value: string;
};

export type CustomerExportDocument = {
  id: string;
  documentType: string;
  status: string | null;
  contentType: string | null;
  originalFilename: string | null;
  createdAt: Date;
  bytes: Buffer;
};

export type CustomerExportPayload = {
  applicationId: string;
  referenceNumber: string | null;
  profileRows: CustomerExportProfileRow[];
  documents: CustomerExportDocument[];
};

export const CUSTOMER_EXPORT_PROFILE_FIELDS: Array<{
  label: string;
  pick: (row: typeof application.$inferSelect) => string;
}> = [
  { label: "Email", pick: (r) => r.guestEmail?.trim() ?? "" },
  { label: "Full name", pick: (r) => r.fullName?.trim() ?? "" },
  {
    label: "Date of birth",
    pick: (r) => formatIsoDateAsDdMmYyyy(r.dateOfBirth ?? null),
  },
  { label: "Nationality", pick: (r) => r.applicantNationality?.trim() ?? "" },
  { label: "Passport number", pick: (r) => r.passportNumber?.trim() ?? "" },
  {
    label: "Passport expiry",
    pick: (r) => formatIsoDateAsDdMmYyyy(r.passportExpiryDate ?? null),
  },
  { label: "Place of birth", pick: (r) => r.placeOfBirth?.trim() ?? "" },
  { label: "Profession", pick: (r) => r.profession?.trim() ?? "" },
  { label: "Address", pick: (r) => r.address?.trim() ?? "" },
  { label: "Phone", pick: (r) => r.phone?.trim() ?? "" },
];

/** RFC 4180-style CSV cell escaping. */
export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCustomerExportCsv(rows: CustomerExportProfileRow[]): string {
  const lines = ["field,value", ...rows.map((r) => `${escapeCsvCell(r.label)},${escapeCsvCell(r.value)}`)];
  return `${lines.join("\r\n")}\r\n`;
}

export function customerExportZipBasename(referenceNumber: string | null, applicationId: string): string {
  const slug = (referenceNumber?.trim() || applicationId.slice(0, 8)).replace(/[^\w.-]+/g, "_");
  return `${slug}-customer-export`;
}

export function zipEntryNameForDocument(doc: CustomerExportDocument, index = 0): string {
  const type = doc.documentType || "document";
  const base = asciiFilename(doc.originalFilename, doc.id.slice(0, 8));
  const extFromName = base.includes(".") ? "" : extensionFromContentType(doc.contentType);
  const suffix = index > 0 ? `-${index + 1}` : "";
  return `documents/${type}${suffix}-${base}${extFromName}`;
}

function extensionFromContentType(contentType: string | null): string {
  switch (contentType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "application/pdf":
      return ".pdf";
    default:
      return "";
  }
}

type DocumentRowFromDb = {
  id: string;
  documentType: string | null;
  status: string | null;
  contentType: string | null;
  originalFilename: string | null;
  createdAt: Date;
  bytes: Buffer | null;
};

function selectCustomerExportDocuments(rows: DocumentRowFromDb[]): CustomerExportDocument[] {
  const sorted = [...rows]
    .filter((row) => row.bytes && row.documentType)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latestByType = new Map<string, CustomerExportDocument>();
  const supporting: CustomerExportDocument[] = [];

  for (const row of sorted) {
    const doc: CustomerExportDocument = {
      id: row.id,
      documentType: row.documentType!,
      status: row.status,
      contentType: row.contentType,
      originalFilename: row.originalFilename,
      createdAt: row.createdAt,
      bytes: Buffer.isBuffer(row.bytes) ? row.bytes! : Buffer.from(row.bytes!),
    };
    if (row.documentType === DOCUMENT_TYPE.SUPPORTING) {
      supporting.push(doc);
      continue;
    }
    if (!latestByType.has(row.documentType!)) {
      latestByType.set(row.documentType!, doc);
    }
  }

  return [...latestByType.values(), ...supporting].sort((a, b) =>
    a.documentType.localeCompare(b.documentType),
  );
}

export async function loadCustomerExportPayload(
  tx: DbTransaction,
  applicationId: string,
): Promise<CustomerExportPayload | null> {
  const appRows = await tx
    .select()
    .from(application)
    .where(eq(application.id, applicationId))
    .limit(1);
  const app = appRows[0];
  if (!app) return null;

  const docRows = await tx
    .select({
      id: applicationDocument.id,
      documentType: applicationDocument.documentType,
      status: applicationDocument.status,
      contentType: applicationDocument.contentType,
      originalFilename: applicationDocument.originalFilename,
      createdAt: applicationDocument.createdAt,
      bytes: applicationDocumentBlob.bytes,
    })
    .from(applicationDocument)
    .leftJoin(applicationDocumentBlob, eq(applicationDocumentBlob.documentId, applicationDocument.id))
    .where(
      and(
        eq(applicationDocument.applicationId, applicationId),
        inArray(applicationDocument.documentType, [...CUSTOMER_UPLOAD_DOCUMENT_TYPES]),
        ne(applicationDocument.status, DOCUMENT_STATUS.DELETED),
        inArray(applicationDocument.status, [...EXPORTABLE_DOC_STATUSES]),
      ),
    );

  const profileRows: CustomerExportProfileRow[] = CUSTOMER_EXPORT_PROFILE_FIELDS.map(({ label, pick }) => ({
    label,
    value: pick(app),
  }));

  for (const doc of selectCustomerExportDocuments(docRows)) {
    profileRows.push({
      label: `Document: ${doc.documentType}`,
      value: doc.originalFilename ?? doc.id,
    });
    profileRows.push({
      label: `Document status: ${doc.documentType}`,
      value: doc.status ?? "",
    });
  }

  return {
    applicationId: app.id,
    referenceNumber: app.referenceNumber,
    profileRows,
    documents: selectCustomerExportDocuments(docRows),
  };
}

export async function buildCustomerExportZip(payload: CustomerExportPayload): Promise<Buffer> {
  const zip = new JSZip();
  const folderName = customerExportZipBasename(payload.referenceNumber, payload.applicationId);
  const root = zip.folder(folderName);
  if (!root) throw new Error("Failed to create export folder");

  root.file("application-data.csv", buildCustomerExportCsv(payload.profileRows));

  const supportingSeen = new Map<string, number>();
  for (const doc of payload.documents) {
    const index =
      doc.documentType === DOCUMENT_TYPE.SUPPORTING
        ? supportingSeen.get(doc.documentType) ?? 0
        : 0;
    if (doc.documentType === DOCUMENT_TYPE.SUPPORTING) {
      supportingSeen.set(doc.documentType, index + 1);
    }
    root.file(zipEntryNameForDocument(doc, index), doc.bytes);
  }

  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}
