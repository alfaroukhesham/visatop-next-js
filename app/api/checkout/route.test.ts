import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "checkout-terms-test" }),
}));

vi.mock("@/lib/applications/application-access", () => ({
  resolveApplicationAccess: vi.fn(),
}));

vi.mock("@/lib/payments/resolve-payment-provider", () => ({
  requireCheckoutAppOrigin: vi.fn(() => "https://visatop.com"),
  assertPaymentsAllowedForOrigin: vi.fn(() => ({ ok: true })),
  getActivePaymentProvider: vi.fn(() => "ziina"),
  assertPaddleServerConfigured: vi.fn(),
  getZiinaServerConfig: vi.fn(),
}));

vi.mock("@/lib/db/actor-context", () => ({
  withSystemDbActor: vi.fn(),
}));

import { resolveApplicationAccess } from "@/lib/applications/application-access";
import * as actor from "@/lib/db/actor-context";
import * as paymentProvider from "@/lib/payments/resolve-payment-provider";
import { POST } from "./route";

const post = (body: unknown) =>
  new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/checkout terms gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveApplicationAccess).mockResolvedValue({
      ok: true,
      access: { kind: "guest", userId: null, isGuest: true },
    });
    vi.mocked(actor.withSystemDbActor).mockImplementation(async () => {
      throw new Error("checkout transaction must not run");
    });
  });

  it("rejects missing termsAccepted before locking checkout or calling the provider", async () => {
    const res = await POST(post({ applicationId: "app-1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("TERMS_NOT_ACCEPTED");
    expect(actor.withSystemDbActor).not.toHaveBeenCalled();
    expect(paymentProvider.requireCheckoutAppOrigin).not.toHaveBeenCalled();
  });

  it("rejects termsAccepted: false", async () => {
    const res = await POST(post({ applicationId: "app-1", termsAccepted: false }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("TERMS_NOT_ACCEPTED");
    expect(actor.withSystemDbActor).not.toHaveBeenCalled();
  });

  it("enters the checkout transaction only when termsAccepted is true", async () => {
    vi.mocked(actor.withSystemDbActor).mockImplementation(async () => {
      return new Response(JSON.stringify({ ok: true, data: { gated: true } }), {
        status: 200,
      });
    });
    const res = await POST(post({ applicationId: "app-1", termsAccepted: true }));
    expect(res.status).toBe(200);
    expect(actor.withSystemDbActor).toHaveBeenCalledTimes(1);
  });
});
