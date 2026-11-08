import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "recovery-cron" }),
}));

vi.mock("@/lib/email/recovery/run", () => ({
  runCheckoutRecoveryEmailJob: vi.fn(),
}));

import { runCheckoutRecoveryEmailJob } from "@/lib/email/recovery/run";
import { POST } from "./route";

describe("POST /api/internal/recovery-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INTERNAL_CRON_SECRET", "cron-secret");
    vi.stubEnv("APP_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips the job on APP_ENV=staging", async () => {
    vi.stubEnv("APP_ENV", "staging");
    const res = await POST(
      new Request("http://localhost/api/internal/recovery-emails", {
        method: "POST",
        headers: { "x-internal-secret": "cron-secret" },
      }),
    );
    expect(res.status).toBe(200);
    expect(runCheckoutRecoveryEmailJob).not.toHaveBeenCalled();
  });

  it("rejects a missing internal secret", async () => {
    const res = await POST(new Request("http://localhost/api/internal/recovery-emails", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(runCheckoutRecoveryEmailJob).not.toHaveBeenCalled();
  });

  it("runs the job when the secret matches", async () => {
    vi.mocked(runCheckoutRecoveryEmailJob).mockResolvedValue({
      enabled: false,
      considered: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    });
    const res = await POST(
      new Request("http://localhost/api/internal/recovery-emails", {
        method: "POST",
        headers: { "x-internal-secret": "cron-secret" },
      }),
    );
    expect(res.status).toBe(200);
    expect(runCheckoutRecoveryEmailJob).toHaveBeenCalledTimes(1);
  });
});
