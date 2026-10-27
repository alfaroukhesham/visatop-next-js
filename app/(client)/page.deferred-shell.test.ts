import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

describe("home first-step JS", () => {
  it("defers the resume modal and auth header off the initial guest paint", () => {
    expect(source).toContain("HomeDeferredShell");
    expect(source).not.toContain("ResumeDraftModal");
    expect(source).not.toContain("ClientAppHeader");
  });
});
