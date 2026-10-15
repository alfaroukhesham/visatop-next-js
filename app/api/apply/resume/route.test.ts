import { beforeEach, describe, expect, it, vi } from "vitest";

const consumeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/applications/resume-email-link", () => ({
  consumeResumeEmailLink: (...args: unknown[]) => consumeMock(...args),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "resume-test" }),
}));

vi.mock("@/lib/app-href", () => ({
  appHref: (path: string) => `http://localhost:3000/visa-processing${path}`,
}));

import { GET, POST } from "./route";

describe("GET/POST /api/apply/resume", () => {
  beforeEach(() => {
    consumeMock.mockReset();
  });

  it("GET with t redirects to the resume page and does not consume the link", async () => {
    const res = await GET(
      new Request("http://localhost/api/apply/resume?t=signed-token"),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/apply/resume?t=signed-token");
    expect(consumeMock).not.toHaveBeenCalled();
  });

  it("GET without t redirects to invalid", async () => {
    const res = await GET(new Request("http://localhost/api/apply/resume"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("invalid=1");
    expect(consumeMock).not.toHaveBeenCalled();
  });

  it("POST redeems, sets the session cookie, and redirects to the application", async () => {
    consumeMock.mockResolvedValue({
      ok: true,
      plainToken: "new-plain",
      maxAgeSeconds: 3600,
      primaryApplicationId: "app-1",
      rotated: true,
    });
    const form = new FormData();
    form.set("t", "signed-token");
    const res = await POST(
      new Request("http://localhost/api/apply/resume", {
        method: "POST",
        body: form,
        headers: { Cookie: "vt_resume=old-plain" },
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/apply/applications/app-1");
    expect(res.headers.get("set-cookie")).toContain("vt_resume=new-plain");
    expect(consumeMock).toHaveBeenCalledWith("signed-token", "old-plain");
  });

  it("POST with an invalid token redirects to invalid", async () => {
    consumeMock.mockResolvedValue({ ok: false });
    const form = new FormData();
    form.set("t", "bad");
    const res = await POST(
      new Request("http://localhost/api/apply/resume", { method: "POST", body: form }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("invalid=1");
  });
});
