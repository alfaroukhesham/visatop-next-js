import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { jsonOk, jsonError } from "@/lib/api/response";
import { readXlsxBuffer } from "@/lib/admin/catalog/read-xlsx-buffer";
import { parseSheetUploadRequest } from "@/lib/admin/catalog/parse-sheet-upload-request";
import { applyPriceSheetImport } from "@/lib/admin/catalog/apply-customer-price-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  return runAdminDbJson(requestId, ["catalog.write", "audit.write"], async ({ tx, adminUserId }) => {
    const parsed = await parseSheetUploadRequest(req);
    if (!parsed.ok) {
      return jsonError("VALIDATION_ERROR", parsed.message, { status: 400, requestId });
    }
    const { buffer, fileHash, mode: parsedMode, catalogScope: parsedCatalogScope } = parsed;
    const mode: "strict" | "partial" = parsedMode ?? "strict";
    const catalogScope = parsedCatalogScope ?? "replace";

    const rows = await readXlsxBuffer(buffer);

    /** Single transactional apply (validation + writes). Avoids duplicating a full preview pass. */
    const result = await applyPriceSheetImport(tx, rows, adminUserId, {
      fileHash,
      mode,
      catalogScope,
    });

    if (!result.committed) {
      if (result.missingNationalities.length > 0) {
        return jsonError(
          "VALIDATION_ERROR",
          "The sheet references countries that are not in the nationality catalog. Create those nationalities, then preview again.",
          {
            status: 400,
            requestId,
            details: {
              mode,
              missingNationalities: result.missingNationalities,
            },
          },
        );
      }
      const isStrictBlocked = mode === "strict" && result.errors.length > 0;
      return jsonError(
        "VALIDATION_ERROR",
        result.headerRowIndex === -1
          ? "Could not detect a valid header row in the uploaded sheet."
          : isStrictBlocked
            ? "Price sheet has validation errors. Fix the sheet or re-apply using Partial mode."
            : "Apply could not be completed. Fix the sheet or try Partial mode.",
        {
          status: 400,
          requestId,
          details: {
            mode,
            headerRowIndex: result.headerRowIndex,
            errorCount: result.errors.length,
            errors: result.errors,
          },
        },
      );
    }

    return jsonOk(
      {
        ...result,
        fileHash,
      },
      { requestId },
    );
  });
}
