import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildUploadErrorDataLayerPayload,
  dataLayerErrorType,
  fileTypeFromUpload,
  pushUploadErrorDataLayer,
  sizeBucketFromBytes,
} from "./upload-error-datalayer";

describe("upload-error-datalayer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps codes, file types, and size buckets without PII", () => {
    expect(dataLayerErrorType("CORRUPT_IMAGE")).toBe("corrupt_image");
    expect(dataLayerErrorType("TIMEOUT")).toBe("timeout");
    expect(fileTypeFromUpload({ name: "a.HEIC", type: "" })).toBe("heic");
    expect(fileTypeFromUpload({ name: "a.pdf", type: "application/pdf" })).toBe("pdf");
    expect(sizeBucketFromBytes(500_000)).toBe("<1MB");
    expect(sizeBucketFromBytes(2 * 1024 * 1024)).toBe("1–3MB");
    expect(sizeBucketFromBytes(7.9 * 1024 * 1024)).toBe("3–8MB");
    expect(sizeBucketFromBytes(9 * 1024 * 1024)).toBe(">8MB");
    const payload = buildUploadErrorDataLayerPayload({
      code: "NETWORK",
      file: { name: "passport-john-smith.heic", type: "image/heic", size: 2_000_000 },
    });
    expect(payload).toEqual({
      event: "upload_error",
      error_type: "network",
      file_type: "heic",
      size_bucket: "1–3MB",
      error_code: "NETWORK",
    });
    expect(
      buildUploadErrorDataLayerPayload({
        code: "PDF_NOT_SINGLE_PAGE",
        file: { name: "scan.pdf", type: "application/pdf", size: 400_000 },
        httpStatus: 400,
      }),
    ).toMatchObject({
      error_type: "pdf_not_single_page",
      error_code: "PDF_NOT_SINGLE_PAGE",
      http_status: 400,
    });
    expect(JSON.stringify(payload)).not.toMatch(/john|smith|passport-john/i);
  });

  it("is a no-op when dataLayer is missing and pushes when present", () => {
    vi.stubGlobal("window", {});
    expect(() =>
      pushUploadErrorDataLayer({
        event: "upload_error",
        error_type: "network",
        file_type: "jpeg",
        size_bucket: "<1MB",
      }),
    ).not.toThrow();

    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", { dataLayer });
    pushUploadErrorDataLayer({
      event: "upload_error",
      error_type: "timeout",
      file_type: "jpeg",
      size_bucket: "3–8MB",
    });
    expect(dataLayer).toEqual([
      { event: "upload_error", error_type: "timeout", file_type: "jpeg", size_bucket: "3–8MB" },
    ]);
  });
});
