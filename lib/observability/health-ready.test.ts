import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getReadinessChecks,
  isOcrConfigPresent,
  isPaymentConfigPresent,
  pingDatabase,
} from "./health-ready";

describe("readiness checks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports payment configured only when the active provider secrets exist", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "paddle");
    vi.stubEnv("PADDLE_API_KEY", "");
    vi.stubEnv("PADDLE_WEBHOOK_SECRET", "");
    expect(isPaymentConfigPresent()).toBe(false);
    vi.stubEnv("PADDLE_API_KEY", "pdl_test");
    vi.stubEnv("PADDLE_WEBHOOK_SECRET", "pdl_wh");
    expect(isPaymentConfigPresent()).toBe(true);

    vi.stubEnv("PAYMENT_PROVIDER", "ziina");
    expect(isPaymentConfigPresent()).toBe(false);
    vi.stubEnv("ZIINA_ACCESS_TOKEN", "ziina_tok");
    vi.stubEnv("ZIINA_WEBHOOK_SECRET", "ziina_wh");
    expect(isPaymentConfigPresent()).toBe(true);
  });

  it("reports OCR configured only when GEMINI_API_KEY is present", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(isOcrConfigPresent()).toBe(false);
    vi.stubEnv("GEMINI_API_KEY", "gemini-secret");
    expect(isOcrConfigPresent()).toBe(true);
  });

  it("treats a successful select 1 as database up", async () => {
    await expect(pingDatabase(async () => ({ rows: [{ "?column?": 1 }] }))).resolves.toBe(true);
    await expect(
      pingDatabase(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    ).resolves.toBe(false);
  });

  it("aggregates booleans only and never echoes secret values", async () => {
    vi.stubEnv("GEMINI_API_KEY", "super-secret-ocr");
    vi.stubEnv("PADDLE_API_KEY", "super-secret-pay");
    vi.stubEnv("PADDLE_WEBHOOK_SECRET", "super-secret-wh");
    const checks = await getReadinessChecks({
      pingDatabase: async () => true,
    });
    expect(checks).toEqual({
      database: true,
      payment: true,
      ocr: true,
    });
    expect(JSON.stringify(checks)).not.toMatch(/super-secret/);
  });
});
