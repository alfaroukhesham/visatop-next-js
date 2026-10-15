import { describe, expect, it } from "vitest";
import {
  generateResumeToken,
  guestResumeTokenMatches,
  hashResumeToken,
  verifyResumeToken,
} from "./resume-token";

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

  it("guestResumeTokenMatches accepts the current hash", () => {
    const { plainToken, hash } = generateResumeToken();
    expect(
      guestResumeTokenMatches(plainToken, {
        resumeTokenHash: hash,
        previousResumeTokenHash: null,
        previousResumeTokenExpiresAt: null,
      }),
    ).toBe(true);
  });

  it("guestResumeTokenMatches accepts the previous hash inside the grace window", () => {
    const previous = generateResumeToken();
    const current = generateResumeToken();
    expect(
      guestResumeTokenMatches(previous.plainToken, {
        resumeTokenHash: current.hash,
        previousResumeTokenHash: previous.hash,
        previousResumeTokenExpiresAt: new Date(Date.now() + 60_000),
      }),
    ).toBe(true);
  });

  it("guestResumeTokenMatches rejects an expired previous hash", () => {
    const previous = generateResumeToken();
    const current = generateResumeToken();
    expect(
      guestResumeTokenMatches(previous.plainToken, {
        resumeTokenHash: current.hash,
        previousResumeTokenHash: previous.hash,
        previousResumeTokenExpiresAt: new Date(Date.now() - 1000),
      }),
    ).toBe(false);
  });
});
