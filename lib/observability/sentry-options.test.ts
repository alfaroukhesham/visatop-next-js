import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSharedSentryInitOptions } from "./sentry-options";

describe("buildSharedSentryInitOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when no DSN is configured", () => {
    vi.stubEnv("SENTRY_DSN", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(buildSharedSentryInitOptions()).toBeNull();
  });

  it("tags environment from APP_ENV and release from git sha", () => {
    vi.stubEnv("SENTRY_DSN", "https://key@glitchtip.example/1");
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("GIT_SHA", "cafebabe");
    const options = buildSharedSentryInitOptions();
    expect(options?.environment).toBe("staging");
    expect(options?.release).toBe("cafebabe");
    expect(options?.sendDefaultPii).toBe(false);
    expect(options?.tracesSampleRate).toBe(0.1);
  });
});
