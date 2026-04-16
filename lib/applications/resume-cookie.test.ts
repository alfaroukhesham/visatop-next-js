import { describe, expect, it } from "vitest";
import {
  buildResumeSetCookieValue,
  readResumeTokenFromRequestCookies,
  RESUME_COOKIE_NAME,
} from "./resume-cookie";

describe("resume-cookie", () => {
  it("buildResumeSetCookieValue includes required attributes", () => {
    const v = buildResumeSetCookieValue("tok", 86400, { secure: false });
    expect(v).toContain(`${RESUME_COOKIE_NAME}=`);
    expect(v).toContain("Max-Age=86400");
    expect(v).toContain("Path=/");
    expect(v).toContain("HttpOnly");
    expect(v).toContain("SameSite=Lax");
    expect(v).not.toContain("Secure");
  });

  it("buildResumeSetCookieValue adds Secure when requested", () => {
    const v = buildResumeSetCookieValue("x", 1, { secure: true });
    expect(v).toContain("Secure");
  });

  it("readResumeTokenFromRequestCookies parses cookie header", () => {
    const token = readResumeTokenFromRequestCookies("other=1; vt_resume=hello%2Bworld; z=3");
    expect(token).toBe("hello+world");
  });
});
