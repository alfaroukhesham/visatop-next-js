import { describe, expect, it } from "vitest";
import { getCurrentTraceId, withSpan } from "./tracing";

describe("withSpan", () => {
  it("is a no-op passthrough when the SDK is not started", async () => {
    const value = await withSpan("gemini.ocr.extract", { provider: "gemini" }, async () => 42);
    expect(value).toBe(42);
    expect(getCurrentTraceId()).toBeUndefined();
  });

  it("rethrows and still returns control to the caller", async () => {
    await expect(
      withSpan("mailgun.send", { provider: "mailgun" }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
