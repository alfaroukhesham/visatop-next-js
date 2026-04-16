import { describe, expect, it } from "vitest";
import { generateResumeToken, hashResumeToken, verifyResumeToken } from "./resume-token";

describe("resume-token", () => {
  it("verifyResumeToken returns true for matching plain token", () => {
    const { plainToken, hash } = generateResumeToken();
    expect(verifyResumeToken(plainToken, hash)).toBe(true);
  });

  it("verifyResumeToken returns false for wrong token", () => {
    const { hash } = generateResumeToken();
    expect(verifyResumeToken("wrong-token", hash)).toBe(false);
  });

  it("hashResumeToken is deterministic", () => {
    const h1 = hashResumeToken("same");
    const h2 = hashResumeToken("same");
    expect(h1).toBe(h2);
  });
});
