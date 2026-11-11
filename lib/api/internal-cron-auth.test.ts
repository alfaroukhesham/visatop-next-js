import { afterEach, describe, expect, it, vi } from "vitest";
import { requireInternalCronSecret, skipIfStagingIdleCron } from "./internal-cron-auth";

describe("internal cron auth / staging idle skip", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a missing secret before any skip", () => {
    vi.stubEnv("INTERNAL_CRON_SECRET", "cron-secret");
    vi.stubEnv("APP_ENV", "staging");
    const res = requireInternalCronSecret(
      new Request("http://localhost/api/internal/x"),
      "rid",
    );
    expect(res?.status).toBe(401);
  });

  it("skips staging idle after a valid secret", async () => {
    vi.stubEnv("APP_ENV", "staging");
    const res = skipIfStagingIdleCron("rid");
    expect(res).not.toBeNull();
    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body.data).toEqual({ skipped: true, reason: "staging_idle_db_wake" });
  });

  it("does not skip production", () => {
    vi.stubEnv("APP_ENV", "production");
    expect(skipIfStagingIdleCron("rid")).toBeNull();
  });

  it("does not skip staging when STAGING_ALLOW_IDLE_DB_WAKE=true", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("STAGING_ALLOW_IDLE_DB_WAKE", "true");
    expect(skipIfStagingIdleCron("rid")).toBeNull();
  });
});
