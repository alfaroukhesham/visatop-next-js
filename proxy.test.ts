import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

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
