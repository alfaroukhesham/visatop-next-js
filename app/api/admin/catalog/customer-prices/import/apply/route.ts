import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { jsonOk, jsonError } from "@/lib/api/response";
import { readXlsxBuffer } from "@/lib/admin/catalog/read-xlsx-buffer";
import {
  applyPriceSheetImport,
  previewPriceSheetImport,
} from "@/lib/admin/catalog/apply-customer-price-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  return runAdminDbJson(requestId, ["catalog.write", "audit.write"], async ({ tx, adminUserId }) => {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonError(
        "VALIDATION_ERROR",
        "Expected multipart/form-data with a 'file' field.",
        { status: 400, requestId },
      );
    }

    let buffer: Buffer;
    let fileHash: string;
    let mode: "strict" | "partial" = "strict";
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
      const rawMode = formData.get("mode");
      if (rawMode && typeof rawMode === "string") {
        const m = rawMode.trim().toLowerCase();
        if (m === "strict" || m === "partial") mode = m;
      }
      const arrayBuffer = await (file as File).arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileHash = createHash("sha256").update(buffer).digest("hex");
    } catch {
      return jsonError(
        "VALIDATION_ERROR",
        "Could not parse uploaded file.",
        { status: 400, requestId },
      );
    }

    const rows = await readXlsxBuffer(buffer);

    // Strict (default): if preview has any errors, abort with zero writes.
    // Partial (explicit): proceed but apply guarded skips for errored rows/cells.
    const preview = await previewPriceSheetImport(tx, rows);
    if (mode === "strict" && preview.errors.length > 0) {
      return jsonError(
        "VALIDATION_ERROR",
        "Price sheet has validation errors. Fix the sheet or re-apply using Partial mode.",
        {
          status: 400,
          requestId,
          details: {
            mode,
            errorCount: preview.errors.length,
            errors: preview.errors,
          },
        },
      );
    }

    const result = await applyPriceSheetImport(tx, rows, adminUserId, {
      fileHash,
      mode,
    });

    if (!result.committed) {
      return jsonError(
        "VALIDATION_ERROR",
        result.headerRowIndex === -1
          ? "Could not detect a valid header row in the uploaded sheet."
          : "Price sheet has validation errors. Fix the sheet or re-apply using Partial mode.",
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
