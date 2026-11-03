import { describe, expect, it, vi } from "vitest";
import { generateResumeToken } from "@/lib/applications/resume-token";
import { promotePreviousResumeTokenIfMatched } from "./promote-previous-resume-token";

describe("promotePreviousResumeTokenIfMatched", () => {
  it("promotes a still-valid previous token to current", async () => {
    const previous = generateResumeToken();
    const current = generateResumeToken();
    const sets: Array<Record<string, unknown>> = [];
    const tx = {
      update: () => ({
        set: (set: Record<string, unknown>) => {
          sets.push(set);
          return { where: async () => undefined };
        },
      }),
    };
    const kind = await promotePreviousResumeTokenIfMatched(
      tx as never,
      {
        id: "app-1",
        partyId: "party-1",
        resumeTokenHash: current.hash,
        previousResumeTokenHash: previous.hash,
        previousResumeTokenExpiresAt: new Date(Date.now() + 60_000),
      },
      previous.plainToken,
    );
    expect(kind).toBe("previous");
    expect(sets[0]?.resumeTokenHash).toBe(previous.hash);
    expect(sets[0]?.previousResumeTokenHash).toBeNull();
    expect(sets[1]?.resumeTokenHash).toBe(previous.hash);
  });

  it("does not rewrite hashes for the current token", async () => {
    const current = generateResumeToken();
    const update = vi.fn();
    const tx = { update };
    const kind = await promotePreviousResumeTokenIfMatched(
      tx as never,
      {
        id: "app-1",
        partyId: "party-1",
        resumeTokenHash: current.hash,
        previousResumeTokenHash: null,
        previousResumeTokenExpiresAt: null,
      },
      current.plainToken,
    );
    expect(kind).toBe("current");
    expect(update).not.toHaveBeenCalled();
  });
});
