import { describe, expect, it } from "vitest";
import {
  buildResumeCookieHeaders,
  buildResumeSetCookieValue,
  readResumeTokenFromRequestCookies,
  readResumeTokensFromRequestCookies,
  RESUME_COOKIE_NAME,
} from "./resume-cookie";

describe("resume-cookie", () => {
  it("buildResumeSetCookieValue includes required attributes", () => {
    const v = buildResumeSetCookieValue("tok", 86400, { secure: false });
    expect(v).toContain(`${RESUME_COOKIE_NAME}=`);
    expect(v).toContain("Max-Age=86400");
    expect(v).toContain("Path=/visa-processing");
    expect(v).toContain("HttpOnly");
    expect(v).toContain("SameSite=Lax");
    expect(v).not.toContain("Secure");
  });

  it("buildResumeCookieHeaders clears Path=/ and sets Path=/visa-processing", () => {
    const headers = buildResumeCookieHeaders("tok", 10, { secure: false });
    const cookies = headers.getSetCookie();
    expect(cookies.some((c) => c.includes("Max-Age=0") && c.includes("Path=/") && !c.includes("visa-processing"))).toBe(
      true,
    );
    expect(cookies.some((c) => c.includes("vt_resume=tok") && c.includes("Path=/visa-processing"))).toBe(true);
  });

  it("buildResumeSetCookieValue adds Secure when requested", () => {
    const v = buildResumeSetCookieValue("x", 1, { secure: true });
    expect(v).toContain("Secure");
  });

  it("readResumeTokenFromRequestCookies parses cookie header", () => {
    const token = readResumeTokenFromRequestCookies("other=1; vt_resume=hello%2Bworld; z=3");
    expect(token).toBe("hello+world");
  });

  it("readResumeTokensFromRequestCookies keeps both Path leftovers", () => {
    const tokens = readResumeTokensFromRequestCookies("vt_resume=stale; vt_resume=current");
    expect(tokens).toEqual(["stale", "current"]);
  });
});
