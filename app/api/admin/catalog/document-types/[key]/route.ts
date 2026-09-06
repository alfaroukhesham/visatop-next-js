import { headers } from "next/headers";
import { deleteCatalogDocumentType } from "@/lib/admin/catalog/document-type";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { jsonError, jsonOk } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ key: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { key: rawKey } = await ctx.params;
  const key = decodeURIComponent(rawKey);

  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      let result: Awaited<ReturnType<typeof deleteCatalogDocumentType>>;
      try {
        result = await deleteCatalogDocumentType(tx, key);
      } catch (e) {
        const code =
          typeof e === "object" && e !== null && "code" in e
            ? String((e as { code: unknown }).code)
            : "";
        if (code === "DOCUMENT_TYPE_NOT_FOUND") {
          return jsonError("NOT_FOUND", "Document not found", { status: 404, requestId });
        }
        throw e;
      }

      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.document_type.delete",
        entityType: "catalog_document_type",
        entityId: result.key,
        beforeJson: JSON.stringify(result),
      });

      return jsonOk(result, { requestId });
    },
  );
}
