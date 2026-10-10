import { describe, expect, it } from "vitest";
import { uploadFailureReason } from "@/lib/analytics/upload-failure";

describe("uploadFailureReason", () => {
  it("buckets recoverable failures without message text", () => {
    expect(uploadFailureReason({ oversized: true })).toBe("file_too_large");
    expect(uploadFailureReason({ httpStatus: 413 })).toBe("file_too_large");
    expect(uploadFailureReason({ httpStatus: 415 })).toBe("file_type");
    expect(uploadFailureReason({ httpStatus: 400, errorCode: "PDF_NOT_SINGLE_PAGE" })).toBe(
      "pdf_not_single_page",
    );
    expect(uploadFailureReason({ httpStatus: 400, errorCode: "CORRUPT_IMAGE" })).toBe("corrupt_file");
    expect(uploadFailureReason({ httpStatus: 429, errorCode: "RATE_LIMITED" })).toBe("rate_limited");
    expect(uploadFailureReason({ httpStatus: 503 })).toBe("server_error");
    expect(uploadFailureReason({ network: true })).toBe("network_error");
    expect(uploadFailureReason({ timeout: true })).toBe("timeout");
    expect(uploadFailureReason({ cancelled: true })).toBe("cancelled");
    expect(uploadFailureReason({ code: "TIMEOUT" })).toBe("timeout");
    expect(uploadFailureReason({ code: "CANCELLED" })).toBe("cancelled");
    expect(uploadFailureReason({ code: "NETWORK" })).toBe("network_error");
    expect(uploadFailureReason({})).toBe("upload_failed");
  });
});
