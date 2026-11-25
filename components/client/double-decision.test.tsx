/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DoubleDecision } from "@/components/client/double-decision";

describe("DoubleDecision dismiss size", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the default dismiss at 16px", () => {
    render(<DoubleDecision dismissLabel="Not now" onDismiss={() => undefined} />);
    expect(screen.getByRole("button", { name: "Not now" })).toHaveClass("text-base");
    expect(screen.getByRole("button", { name: "Not now" }).className).not.toContain("text-[15px]");
  });

  it("lets Details Previous use 15px without changing other dismiss buttons", () => {
    render(
      <DoubleDecision dismissClassName="text-[15px]" dismissLabel="Previous" onDismiss={() => undefined} />,
    );
    const previous = screen.getByRole("button", { name: "Previous" });
    expect(previous).toHaveClass("text-[15px]");
    expect(previous.className).not.toMatch(/(?:^|\s)text-base(?:\s|$)/);

    const details = readFileSync(
      join(process.cwd(), "components/apply/draft/applicant-review.tsx"),
      "utf8",
    );
    const resume = readFileSync(join(process.cwd(), "components/apply/resume-draft-modal.tsx"), "utf8");
    expect(details).toMatch(/dismissClassName="text-\[15px\]"/);
    expect(resume).not.toMatch(/dismissClassName/);
    expect(resume).not.toMatch(/text-\[15px\]/);
  });
});
