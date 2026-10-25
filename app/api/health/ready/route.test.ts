import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "ready-test" }),
}));

vi.mock("@/lib/observability/health-ready", () => ({
  getReadinessChecks: vi.fn(),
}));

import { getReadinessChecks } from "@/lib/observability/health-ready";
import { GET } from "./route";

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with boolean checks when dependencies are ready", async () => {
    vi.mocked(getReadinessChecks).mockResolvedValue({
      database: true,
      payment: true,
      ocr: true,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      data: {
        ready: true,
        checks: { database: true, payment: true, ocr: true },
      },
      meta: { requestId: "ready-test" },
    });
    expect(JSON.stringify(body)).not.toMatch(/KEY|SECRET|TOKEN|password/i);
  });

  it("returns 503 when any check fails and still only exposes booleans", async () => {
    vi.mocked(getReadinessChecks).mockResolvedValue({
      database: false,
      payment: true,
      ocr: false,
    });
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      ready: false,
      checks: { database: false, payment: true, ocr: false },
    });
  });
});
