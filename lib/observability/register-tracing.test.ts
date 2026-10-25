import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startOtelNodeSdk = vi.fn(async () => {});
const shutdownOtelNodeSdk = vi.fn(async () => {});

vi.mock("./otel-sdk", () => ({
  startOtelNodeSdk: () => startOtelNodeSdk(),
  shutdownOtelNodeSdk: () => shutdownOtelNodeSdk(),
}));

describe("registerTracing", () => {
  const originalEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const originalTraces = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

  beforeEach(() => {
    startOtelNodeSdk.mockClear();
    shutdownOtelNodeSdk.mockClear();
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  });

  afterEach(() => {
    if (originalEndpoint === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = originalEndpoint;
    if (originalTraces === undefined) delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    else process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = originalTraces;
  });

  it("does not start the SDK when no OTLP endpoint is configured", async () => {
    const { registerTracing } = await import("./register-tracing");
    await registerTracing();
    expect(startOtelNodeSdk).not.toHaveBeenCalled();
  });

  it("starts the SDK when Alloy OTLP is configured", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://alloy:4318";
    const { registerTracing } = await import("./register-tracing");
    await registerTracing();
    expect(startOtelNodeSdk).toHaveBeenCalledTimes(1);
  });
});
