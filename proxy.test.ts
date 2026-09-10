import { NextRequest } from "next/server";
import { CUSTOMER_LOCALE_COOKIE } from "@/lib/i18n/customer-locale";
import { config, proxy } from "@/proxy";

function requestFor(pathname: string, search = ""): NextRequest {
  return new NextRequest(`https://visatop.com${pathname}${search}`);
}

describe("proxy trailing-slash redirect", () => {
  it("308-redirects /visa-processing/ to /visa-processing", () => {
    const response = proxy(requestFor("/visa-processing/"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://visatop.com/visa-processing");
  });

  it("308-redirects nested trailing-slash paths", () => {
    const response = proxy(requestFor("/visa-processing/sign-in/"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://visatop.com/visa-processing/sign-in");
  });

  it("preserves query strings", () => {
    const response = proxy(requestFor("/visa-processing/", "?ref=llms"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://visatop.com/visa-processing?ref=llms",
    );
  });

  it("passes through canonical no-slash URLs", () => {
    const response = proxy(requestFor("/visa-processing"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("proxy matcher", () => {
  it("omits the /visa-processing prefix so Next.js basePath is not applied twice", () => {
    for (const source of config.matcher) {
      expect(source).not.toMatch(/^\/visa-processing(?:\/|$)/);
    }
    expect(config.matcher).toEqual(expect.arrayContaining(["/", "/apply/:path*"]));
  });
});

describe("proxy customer locale cookie", () => {
  it("sets vt_locale when ?locale=ar is valid", () => {
    const response = proxy(requestFor("/visa-processing", "?locale=ar"));
    expect(response.status).toBe(200);
    const cookie = response.cookies.get(CUSTOMER_LOCALE_COOKIE);
    expect(cookie?.value).toBe("ar");
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.httpOnly).toBe(false);
  });

  it("forwards the locale to the request so the first render is not stuck on English", () => {
    const response = proxy(requestFor("/visa-processing", "?locale=ar"));
    expect(response.headers.get("x-middleware-request-x-vt-locale")).toBe("ar");
  });

  it("normalizes ?locale=FR to fr", () => {
    const response = proxy(requestFor("/visa-processing/apply/start", "?locale=FR"));
    expect(response.cookies.get(CUSTOMER_LOCALE_COOKIE)?.value).toBe("fr");
  });

  it("does not set cookie for unknown locale", () => {
    const response = proxy(requestFor("/visa-processing", "?locale=junk"));
    expect(response.cookies.get(CUSTOMER_LOCALE_COOKIE)).toBeUndefined();
  });

  it("preserves x-request-id when setting locale cookie", () => {
    const req = new NextRequest("https://visatop.com/visa-processing?locale=ar", {
      headers: { "x-request-id": "req-locale-1" },
    });
    const response = proxy(req);
    expect(response.headers.get("x-request-id")).toBe("req-locale-1");
  });
});
