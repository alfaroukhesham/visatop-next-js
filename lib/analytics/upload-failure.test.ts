import { describe, expect, it } from "vitest";
import { uploadFailureReason } from "@/lib/analytics/upload-failure";

describe("uploadFailureReason", () => {
  it("buckets recoverable failures without message text", () => {
    expect(uploadFailureReason({ oversized: true })).toBe("file_too_large");
    expect(uploadFailureReason({ httpStatus: 413 })).toBe("file_too_large");
    expect(uploadFailureReason({ httpStatus: 415 })).toBe("upload_rejected");
    expect(uploadFailureReason({ httpStatus: 503 })).toBe("server_error");
    expect(uploadFailureReason({ network: true })).toBe("network_error");
    expect(uploadFailureReason({})).toBe("upload_failed");
  });
});
