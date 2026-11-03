import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hostFromWebhookUrl,
  isNonProdZiinaWebhookRegistrar,
  ziinaWebhookUrlMatchesExpected,
} from "./ziina-webhook-url";

describe("ziina-webhook-url", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats staging host as not matching prod", () => {
    const prod = "https://visatop.com/visa-processing/api/webhooks/ziina";
    const staging = "https://app-staging.visatop.com/visa-processing/api/webhooks/ziina";
    expect(ziinaWebhookUrlMatchesExpected(prod, prod)).toBe(true);
    expect(ziinaWebhookUrlMatchesExpected(staging, prod)).toBe(false);
    expect(hostFromWebhookUrl(staging)).toBe("app-staging.visatop.com");
  });

  it("flags a registrar whose origin is not the expected prod webhook URL", () => {
    vi.stubEnv(
      "ZIINA_EXPECTED_WEBHOOK_URL",
      "https://visatop.com/visa-processing/api/webhooks/ziina",
    );
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app-staging.visatop.com/visa-processing");
    expect(isNonProdZiinaWebhookRegistrar()).toBe(true);
  });
});
