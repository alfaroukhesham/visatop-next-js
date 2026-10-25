import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRACE_SAMPLER_RATIO,
  applyOtelSamplerEnv,
  resolveTraceSamplerRatio,
  shouldSampleTraceId,
} from "./sampler-ratio";

describe("trace sampler ratio", () => {
  it("defaults to 1 for low traffic", () => {
    expect(DEFAULT_TRACE_SAMPLER_RATIO).toBe(1);
    expect(resolveTraceSamplerRatio({})).toBe(1);
  });

  it("reads OTEL_TRACES_SAMPLER_RATIO over OTEL_TRACES_SAMPLER_ARG", () => {
    expect(
      resolveTraceSamplerRatio({
        OTEL_TRACES_SAMPLER_RATIO: "0.25",
        OTEL_TRACES_SAMPLER_ARG: "0.9",
      }),
    ).toBe(0.25);
  });

  it("clamps out-of-range values", () => {
    expect(resolveTraceSamplerRatio({ OTEL_TRACES_SAMPLER_RATIO: "2" })).toBe(1);
    expect(resolveTraceSamplerRatio({ OTEL_TRACES_SAMPLER_RATIO: "-1" })).toBe(0);
  });

  it("samples every valid trace id at ratio 1", () => {
    expect(shouldSampleTraceId("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 1)).toBe(true);
  });

  it("samples none at ratio 0", () => {
    expect(shouldSampleTraceId("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 0)).toBe(false);
  });

  it("defaults OTEL sampler env to parent-based ratio without clobbering overrides", () => {
    const env: Record<string, string | undefined> = {};
    applyOtelSamplerEnv(env);
    expect(env.OTEL_TRACES_SAMPLER).toBe("parentbased_traceidratio");
    expect(env.OTEL_TRACES_SAMPLER_ARG).toBe("1");

    const explicit: Record<string, string | undefined> = {
      OTEL_TRACES_SAMPLER: "always_on",
      OTEL_TRACES_SAMPLER_ARG: "unused",
    };
    applyOtelSamplerEnv(explicit);
    expect(explicit.OTEL_TRACES_SAMPLER).toBe("always_on");
    expect(explicit.OTEL_TRACES_SAMPLER_ARG).toBe("unused");
  });
});
