import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { jsonOk, jsonError } from "@/lib/api/response";
import { readXlsxBuffer } from "@/lib/admin/catalog/read-xlsx-buffer";
import { parseSheetUploadRequest } from "@/lib/admin/catalog/parse-sheet-upload-request";
import { previewPriceSheetImport } from "@/lib/admin/catalog/apply-customer-price-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const parsed = await parseSheetUploadRequest(req);
    if (!parsed.ok) {
      return jsonError("VALIDATION_ERROR", parsed.message, { status: 400, requestId });
    }
    const { buffer } = parsed;

    const rows = await readXlsxBuffer(buffer);
    const preview = await previewPriceSheetImport(tx, rows);

    return jsonOk(preview, { requestId });
  });
}
