import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALLOY_OTLP_HTTP_ENDPOINT,
  isTracingExportEnabled,
  normalizeOtlpTracesUrl,
  resolveOtlpTracesUrl,
} from "./otlp-endpoint";

describe("OTLP endpoint", () => {
  it("documents the Alloy receiver on the Docker network", () => {
    expect(DEFAULT_ALLOY_OTLP_HTTP_ENDPOINT).toBe("http://alloy:4318");
  });

  it("is disabled when no endpoint is configured", () => {
    expect(isTracingExportEnabled({})).toBe(false);
    expect(resolveOtlpTracesUrl({})).toBeUndefined();
  });

  it("appends /v1/traces to the Alloy base URL", () => {
    expect(normalizeOtlpTracesUrl("http://alloy:4318")).toBe("http://alloy:4318/v1/traces");
    expect(normalizeOtlpTracesUrl("http://alloy:4318/")).toBe("http://alloy:4318/v1/traces");
  });

  it("does not double the traces path", () => {
    expect(normalizeOtlpTracesUrl("http://alloy:4318/v1/traces")).toBe(
      "http://alloy:4318/v1/traces",
    );
  });

  it("prefers OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", () => {
    expect(
      resolveOtlpTracesUrl({
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://alloy:4318",
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://alloy:4318/v1/traces",
      }),
    ).toBe("http://alloy:4318/v1/traces");
  });
});
