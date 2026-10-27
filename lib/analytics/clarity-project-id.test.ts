import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CLARITY_PROJECT_ID, getClarityProjectId } from "@/lib/analytics/clarity-project-id";

const originalProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

afterEach(() => {
  if (originalProjectId === undefined) {
    delete process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  } else {
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = originalProjectId;
  }
});

describe("getClarityProjectId", () => {
  it("defaults to the WordPress visatop.com project when unset", () => {
    delete process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    expect(getClarityProjectId()).toBe(DEFAULT_CLARITY_PROJECT_ID);
    expect(DEFAULT_CLARITY_PROJECT_ID).toBe("waxpllatey");
  });

  it("uses the env override when set", () => {
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = "customproject";
    expect(getClarityProjectId()).toBe("customproject");
  });

  it("returns empty when the env override is explicitly empty", () => {
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = "";
    expect(getClarityProjectId()).toBe("");
  });

  it("treats whitespace-only as empty so the script is skipped", () => {
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = "   ";
    expect(getClarityProjectId()).toBe("");
  });
});
