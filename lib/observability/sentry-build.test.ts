import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSentryWebpackPluginOptions } from "./sentry-build";

describe("buildSentryWebpackPluginOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("disables source-map upload so CI builds do not need a Sentry auth token", () => {
    const options = buildSentryWebpackPluginOptions();
    expect(options.sourcemaps.disable).toBe(true);
    expect(options.release.create).toBe(false);
    expect(options.authToken).toBeUndefined();
    expect(options.telemetry).toBe(false);
  });

  it("enables optional upload only when GlitchTip URL and token are set", () => {
    vi.stubEnv("SENTRY_AUTH_TOKEN", "gt-token");
    vi.stubEnv("SENTRY_URL", "https://glitchtip.example");
    vi.stubEnv("SENTRY_ORG", "visatop");
    vi.stubEnv("SENTRY_PROJECT", "portal");
    vi.stubEnv("GIT_SHA", "deadbeef");
    const options = buildSentryWebpackPluginOptions();
    expect(options.sourcemaps.disable).toBe(false);
    expect(options.release.create).toBe(true);
    expect(options.authToken).toBe("gt-token");
    expect(options.sentryUrl).toBe("https://glitchtip.example");
    expect(options.release.name).toBe("deadbeef");
  });
});
