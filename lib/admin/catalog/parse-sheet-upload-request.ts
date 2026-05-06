import { createHash } from "node:crypto";

export type ParsedSheetUpload =
  | {
      ok: true;
      buffer: Buffer;
      fileHash: string;
      /** Apply only: strict | partial (default strict). */
      mode?: "strict" | "partial";
    }
  | { ok: false; message: string };

/**
 * Read XLSX bytes from a POST body.
 *
 * Prefer `application/octet-stream` (raw file bytes): Next.js can mis-handle
 * `multipart/form-data` POSTs as Server Actions and return HTML 500
 * ("Failed to find Server Action") before the Route Handler runs.
 *
 * Legacy: `multipart/form-data` with field `file` (and optional `mode` for apply).
 */
export async function parseSheetUploadRequest(req: Request): Promise<ParsedSheetUpload> {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("application/octet-stream")) {
    const buffer = Buffer.from(await req.arrayBuffer());
    if (!buffer.byteLength) {
      return { ok: false, message: "Empty request body." };
    }
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const rawMode = req.headers.get("x-import-mode")?.trim().toLowerCase();
    const mode =
      rawMode === "strict" || rawMode === "partial" ? (rawMode as "strict" | "partial") : undefined;
    return { ok: true, buffer, fileHash, mode };
  }

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        return { ok: false, message: "Missing 'file' field in multipart form." };
      }
      const arrayBuffer = await (file as File).arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileHash = createHash("sha256").update(buffer).digest("hex");
      let mode: "strict" | "partial" | undefined;
      const rawMode = formData.get("mode");
      if (rawMode && typeof rawMode === "string") {
        const m = rawMode.trim().toLowerCase();
        if (m === "strict" || m === "partial") mode = m;
      }
      return { ok: true, buffer, fileHash, mode };
    } catch {
      return { ok: false, message: "Could not parse multipart upload." };
    }
  }

  return {
    ok: false,
    message:
      "Unsupported Content-Type. Send application/octet-stream (raw XLSX bytes) or multipart/form-data with a 'file' field.",
  };
}
