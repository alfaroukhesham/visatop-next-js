import { headers } from "next/headers";
import { z } from "zod";
import {
  createCatalogDocumentType,
  listCatalogDocumentTypes,
} from "@/lib/admin/catalog/document-type";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBodySchema = z.object({
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(280).optional(),
});

const messageFor = (code: string): string => {
  switch (code) {
    case "DOCUMENT_TYPE_LABEL_REQUIRED":
      return "Document name is required";
    case "DOCUMENT_TYPE_KEY_INVALID":
      return "That name cannot be used. Passport and personal photo are always required and cannot be added again.";
    default:
      return "Document type operation failed";
  }
};

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const documents = await listCatalogDocumentTypes(tx);
    return jsonOk({ documents }, { requestId });
  });
}

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, createBodySchema, requestId);
      if (!parsed.ok) return parsed.response;

      let document: Awaited<ReturnType<typeof createCatalogDocumentType>>;
      try {
        document = await createCatalogDocumentType(tx, parsed.data);
      } catch (e) {
        const code =
          typeof e === "object" && e !== null && "code" in e
            ? String((e as { code: unknown }).code)
            : "";
        if (code.startsWith("DOCUMENT_TYPE_")) {
          return jsonError(code as ApiErrorCode, messageFor(code), { status: 400, requestId });
        }
        throw e;
      }

      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.document_type.create",
        entityType: "catalog_document_type",
        entityId: document.key,
        afterJson: JSON.stringify(document),
      });

      return jsonOk({ document }, { requestId });
    },
  );
}
