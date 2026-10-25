import { afterEach, describe, expect, it, vi } from "vitest";
import { mailgunSendText } from "./mailgun";

describe("mailgunSendText tracing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
  });

  it("does not put the recipient on any span attributes (send still works)", async () => {
    process.env.MAILGUN_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mail.example.test";
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await mailgunSendText({
      to: "ada@example.com",
      subject: "hi",
      text: "body",
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: expect.stringMatching(/^Basic /) });
  });
});
