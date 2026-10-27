import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WP_SHELL_HEADER_COLLISION_MAX_WIDTH_PX,
  WP_SHELL_NARROW_HEADER_CSS,
} from "./wp-shell-header-narrow-css";

describe("WP_SHELL_NARROW_HEADER_CSS", () => {
  it("only targets viewports below 320px so 320/375/414 and desktop stay as-is", () => {
    expect(WP_SHELL_HEADER_COLLISION_MAX_WIDTH_PX).toBe(319);
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain(
      `@media screen and (max-width: ${WP_SHELL_HEADER_COLLISION_MAX_WIDTH_PX}px)`,
    );
    expect(WP_SHELL_NARROW_HEADER_CSS).not.toMatch(/@media[^{]+max-width:\s*(4\d{2}|[5-9]\d{2}|[1-9]\d{3})px/);
  });

  it("drops in-bar Apply Now, keeps it in the open drawer, and lets featured-on logos wrap", () => {
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("header#header nav.menu ul li.button");
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("display: none !important");
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain(
      "body.show-menu header#header nav.menu ul li.button",
    );
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("header#header .featured_on .inner");
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("flex-wrap: wrap");
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("overflow: visible");
  });

  it("is injected only into the header iframe srcdoc", () => {
    const frame = readFileSync(path.join(__dirname, "wp-shell-frame.tsx"), "utf8");
    expect(frame).toContain("WP_SHELL_NARROW_HEADER_CSS");
    expect(frame).toContain('input.kind === "header" ? WP_SHELL_NARROW_HEADER_CSS : ""');
  });
});
