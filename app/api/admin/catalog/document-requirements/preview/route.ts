import { headers } from "next/headers";
import { previewDocumentRequirementAssign } from "@/lib/admin/catalog/document-requirement-assign";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { assignBodySchema } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const parsed = await parseJsonBody(req, assignBodySchema, requestId);
    if (!parsed.ok) return parsed.response;

    const { documentType, role, pairs } = parsed.data;
    let preview: {
      pairCount: number;
      alreadyEligible: number;
      willCreateEligibility: number;
      pairsWithoutPrice: number;
      alreadyHasDocument: number;
      willInsert: number;
      willUpdateRole: number;
    };
    try {
      preview = await previewDocumentRequirementAssign(tx, {
        documentType,
        role,
        pairs,
      });
    } catch (e) {
      const code =
        typeof e === "object" && e !== null && "code" in e
          ? String((e as { code: unknown }).code)
          : "";
      if (code.startsWith("DOCUMENT_REQUIREMENTS_")) {
        return jsonError(code as never, "Document requirement operation failed", {
          status: code === "DOCUMENT_REQUIREMENTS_NOT_FOUND" ? 404 : 400,
          requestId,
        });
      }
      throw e;
    }

    return jsonOk(preview, { requestId });
  });
}
