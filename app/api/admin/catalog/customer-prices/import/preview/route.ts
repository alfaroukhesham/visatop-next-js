import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { jsonOk, jsonError } from "@/lib/api/response";
import { readXlsxBuffer } from "@/lib/admin/catalog/read-xlsx-buffer";
import { previewPriceSheetImport } from "@/lib/admin/catalog/apply-customer-price-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonError(
        "VALIDATION_ERROR",
        "Expected multipart/form-data with a 'file' field.",
        { status: 400, requestId },
      );
    }

    let buffer: Buffer;
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        return jsonError(
          "VALIDATION_ERROR",
          "Missing 'file' field in multipart form.",
          { status: 400, requestId },
        );
      }
      const arrayBuffer = await (file as File).arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch {
      return jsonError(
        "VALIDATION_ERROR",
        "Could not parse uploaded file.",
        { status: 400, requestId },
      );
    }

    const rows = await readXlsxBuffer(buffer);
    const preview = await previewPriceSheetImport(tx, rows);

    return jsonOk(preview, { requestId });
  });
}
