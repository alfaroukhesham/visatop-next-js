import { describe, expect, it } from "vitest";
import { shouldSkipStagingIdleDbWake } from "./staging-idle-db-wake";

describe("shouldSkipStagingIdleDbWake", () => {
  it("never skips production", () => {
    expect(shouldSkipStagingIdleDbWake({ APP_ENV: "production" })).toBe(false);
    expect(
      shouldSkipStagingIdleDbWake({
        APP_ENV: "production",
        STAGING_ALLOW_IDLE_DB_WAKE: "false",
      }),
    ).toBe(false);
  });

  it("never skips development, test, or unset APP_ENV", () => {
    expect(shouldSkipStagingIdleDbWake({})).toBe(false);
    expect(shouldSkipStagingIdleDbWake({ APP_ENV: "development" })).toBe(false);
    expect(shouldSkipStagingIdleDbWake({ APP_ENV: "test" })).toBe(false);
  });

  it("skips on droplet staging by default", () => {
    expect(shouldSkipStagingIdleDbWake({ APP_ENV: "staging" })).toBe(true);
    expect(
      shouldSkipStagingIdleDbWake({
        APP_ENV: "staging",
        STAGING_ALLOW_IDLE_DB_WAKE: "false",
      }),
    ).toBe(true);
  });

  it("runs staging probes/crons when STAGING_ALLOW_IDLE_DB_WAKE is true or 1", () => {
    expect(
      shouldSkipStagingIdleDbWake({
        APP_ENV: "staging",
        STAGING_ALLOW_IDLE_DB_WAKE: "true",
      }),
    ).toBe(false);
    expect(
      shouldSkipStagingIdleDbWake({
        APP_ENV: "staging",
        STAGING_ALLOW_IDLE_DB_WAKE: "1",
      }),
    ).toBe(false);
    expect(
      shouldSkipStagingIdleDbWake({
        APP_ENV: "staging",
        STAGING_ALLOW_IDLE_DB_WAKE: "TRUE",
      }),
    ).toBe(false);
  });
});
