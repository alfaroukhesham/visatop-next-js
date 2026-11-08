import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "health-pay" }),
}));

vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: vi.fn(),
}));

vi.mock("@/lib/payments/payments-health", () => ({
  collectPaymentsHealth: vi.fn(),
}));

import * as actor from "@/lib/db/actor-context";
import { collectPaymentsHealth } from "@/lib/payments/payments-health";
import { GET } from "./route";

describe("GET /api/internal/health/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INTERNAL_CRON_SECRET", "cron-secret");
    vi.stubEnv("APP_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const req = () =>
    new Request("http://localhost/api/internal/health/payments", {
      headers: { "x-internal-secret": "cron-secret" },
    });

  it("skips DB work on APP_ENV=staging", async () => {
    vi.stubEnv("APP_ENV", "staging");
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ skipped: true, reason: "staging_idle_db_wake" });
    expect(actor.withSystemDbActor).not.toHaveBeenCalled();
  });

  it("does not skip production", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.mocked(actor.withSystemDbActor).mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({}),
    );
    vi.mocked(collectPaymentsHealth).mockResolvedValue({
      ok: true,
      alerts: [],
      webhook: {
        expectedUrl: "https://visatop.com/visa-processing/api/webhooks/ziina",
        registeredUrl: "https://visatop.com/visa-processing/api/webhooks/ziina",
        registeredHost: "visatop.com",
        lastLocalRegistrationHost: "visatop.com",
        unreadable: false,
      },
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(actor.withSystemDbActor).toHaveBeenCalled();
  });

  it("returns 401 without the internal secret", async () => {
    const res = await GET(new Request("http://localhost/api/internal/health/payments"));
    expect(res.status).toBe(401);
    expect(actor.withSystemDbActor).not.toHaveBeenCalled();
  });

  it("returns 200 when there are no alerts", async () => {
    vi.mocked(actor.withSystemDbActor).mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({}),
    );
    vi.mocked(collectPaymentsHealth).mockResolvedValue({
      ok: true,
      alerts: [],
      webhook: {
        expectedUrl: "https://visatop.com/visa-processing/api/webhooks/ziina",
        registeredUrl: "https://visatop.com/visa-processing/api/webhooks/ziina",
        registeredHost: "visatop.com",
        lastLocalRegistrationHost: "visatop.com",
        unreadable: false,
      },
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
  });

  it("returns 503 when a webhook URL mismatch is reported", async () => {
    vi.mocked(actor.withSystemDbActor).mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({}),
    );
    vi.mocked(collectPaymentsHealth).mockResolvedValue({
      ok: false,
      alerts: [
        {
          id: "webhook_url_mismatch",
          message: "webhook registered to app-staging.visatop.com, not prod",
        },
      ],
      webhook: {
        expectedUrl: "https://visatop.com/visa-processing/api/webhooks/ziina",
        registeredUrl: "https://app-staging.visatop.com/visa-processing/api/webhooks/ziina",
        registeredHost: "app-staging.visatop.com",
        lastLocalRegistrationHost: "app-staging.visatop.com",
        unreadable: false,
      },
    });
    const res = await GET(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.details.alerts[0].message).toMatch(/app-staging\.visatop\.com/);
  });
});
