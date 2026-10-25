import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSentryEnabled,
  resolveAppEnv,
  resolveSentryDsn,
  resolveSentryRelease,
  resolveTracesSampleRate,
  shouldUploadGlitchTipSourceMaps,
} from "./sentry-env";

describe("sentry-env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is a no-op when no DSN is set", () => {
    vi.stubEnv("SENTRY_DSN", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(resolveSentryDsn()).toBeUndefined();
    expect(isSentryEnabled()).toBe(false);
  });

  it("enables when SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN is present", () => {
    vi.stubEnv("SENTRY_DSN", "https://key@glitchtip.example/1");
    expect(resolveSentryDsn()).toBe("https://key@glitchtip.example/1");
    expect(isSentryEnabled()).toBe(true);
  });

  it("uses APP_ENV rather than NODE_ENV for the Sentry environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "staging");
    expect(resolveAppEnv()).toBe("staging");
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    expect(resolveAppEnv()).toBe("production");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "");
    expect(resolveAppEnv()).not.toBe("production");
    expect(resolveAppEnv()).toBe("development");
  });

  it("prefers an explicit git sha release", () => {
    vi.stubEnv("GIT_SHA", "abc123def");
    expect(resolveSentryRelease()).toBe("abc123def");
    vi.stubEnv("SENTRY_RELEASE", "rel-9");
    expect(resolveSentryRelease()).toBe("rel-9");
  });

  it("keeps performance sampling modest by default", () => {
    expect(resolveTracesSampleRate()).toBe(0.1);
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "0.05");
    expect(resolveTracesSampleRate()).toBe(0.05);
    vi.stubEnv("SENTRY_TRACES_SAMPLE_RATE", "2");
    expect(resolveTracesSampleRate()).toBe(1);
  });

  it("uploads source maps to GlitchTip only when URL and token are both set", () => {
    expect(shouldUploadGlitchTipSourceMaps()).toBe(false);
    vi.stubEnv("SENTRY_AUTH_TOKEN", "token");
    expect(shouldUploadGlitchTipSourceMaps()).toBe(false);
    vi.stubEnv("SENTRY_URL", "https://glitchtip.example");
    expect(shouldUploadGlitchTipSourceMaps()).toBe(true);
  });
});
