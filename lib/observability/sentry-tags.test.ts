import { describe, expect, it, vi, afterEach } from "vitest";
import {
  applyObservabilityTags,
  extractApplicationIdFromPath,
  resolvePaymentProviderTag,
} from "./sentry-tags";

describe("sentry-tags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("extracts applicationId from apply and checkout paths", () => {
    expect(extractApplicationIdFromPath("/visa-processing/apply/applications/app_abc")).toBe(
      "app_abc",
    );
    expect(
      extractApplicationIdFromPath("/apply/applications/app_abc/payment"),
    ).toBe("app_abc");
    expect(
      extractApplicationIdFromPath("/visa-processing/apply/applications/app_abc/checkout/return"),
    ).toBe("app_abc");
    expect(extractApplicationIdFromPath("/visa-processing/apply/start")).toBeUndefined();
    expect(extractApplicationIdFromPath("/admin/applications/app_abc")).toBeUndefined();
  });

  it("reads the active payment provider without inventing one", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "ziina");
    expect(resolvePaymentProviderTag()).toBe("ziina");
    vi.stubEnv("PAYMENT_PROVIDER", "");
    expect(resolvePaymentProviderTag()).toBe("paddle");
  });

  it("fills missing applicationId and payment_provider tags on events", () => {
    const event = applyObservabilityTags({
      request: { url: "https://visatop.com/visa-processing/apply/applications/app_9/payment" },
    });
    expect(event.tags?.applicationId).toBe("app_9");
    expect(event.tags?.payment_provider).toBe("paddle");
  });
});
