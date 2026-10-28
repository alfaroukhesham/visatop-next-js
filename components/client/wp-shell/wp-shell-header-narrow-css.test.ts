import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WP_SHELL_HEADER_COLLISION_MAX_WIDTH_PX,
  WP_SHELL_NARROW_HEADER_CSS,
  WP_SHELL_OPEN_MENU_NARROW_CSS,
  WP_SHELL_OPEN_MENU_NARROW_MAX_WIDTH_PX,
} from "./wp-shell-header-narrow-css";

describe("WP_SHELL_NARROW_HEADER_CSS", () => {
  it("only targets viewports below 320px so 320/375/414 and desktop stay as-is", () => {
    expect(WP_SHELL_HEADER_COLLISION_MAX_WIDTH_PX).toBe(319);
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain(
      `@media screen and (max-width: ${WP_SHELL_HEADER_COLLISION_MAX_WIDTH_PX}px)`,
    );
    expect(WP_SHELL_NARROW_HEADER_CSS).not.toMatch(/@media[^{]+max-width:\s*(4\d{2}|[5-9]\d{2}|[1-9]\d{3})px/);
  });

  it("drops in-bar Apply Now (header-apply-now sibling) and lets featured-on logos wrap", () => {
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("header#header a.header-apply-now");
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("header#header a.header-whatsapp");
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("header#header nav.menu ul li.button");
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("display: none !important");
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("header#header .featured_on .inner");
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("flex-wrap: wrap");
    expect(WP_SHELL_NARROW_HEADER_CSS).toContain("overflow: visible");
  });

  it("is injected only into the header iframe srcdoc", () => {
    const frame = readFileSync(path.join(__dirname, "wp-shell-frame.tsx"), "utf8");
    expect(frame).toContain("WP_SHELL_NARROW_HEADER_CSS");
    expect(frame).toContain('input.kind === "header" ? WP_SHELL_NARROW_HEADER_CSS : ""');
    expect(frame).toContain("const HEADER_SLOT_HEIGHT_PX = 130");
    expect(frame).toContain("HEADER_PLACEHOLDER_SRCDOC");
    expect(frame).toContain("useSyncExternalStore");
    expect(frame).toContain('data-wp-shell-slot="header"');
    expect(frame).toContain("headerRevealed");
    expect(frame).toContain(': "block"');
    expect(frame).toContain("height={heightPx}");
    expect(frame).toContain('width={props.kind === "header" ? 412 : 1280}');
    expect(frame).toContain("data-wp-shell-slot=\"header\"");
    expect(frame).toContain("const HEADER_SLOT_HEIGHT_PX = 130");
  });

  it("scopes #53 header iframe locks and Google Fonts gating to compact viewports", () => {
    const frame = readFileSync(path.join(__dirname, "wp-shell-frame.tsx"), "utf8");
    expect(frame).toContain("wpShellStylesheetLinks");
    expect(frame).toContain("wpShellHeaderCspMeta");
    expect(frame).toContain("WP_SHELL_COMPACT_HEADER_OVERRIDES_CSS");
    expect(frame).toContain("WP_SHELL_DESKTOP_FEATURED_LOGO_CSS");
    expect(frame).toContain("sizeWpShellHeaderImages");
    expect(frame).toContain("WP_SHELL_COMPACT_MQ");
    expect(frame).toContain("matchMedia");
    expect(frame).not.toContain("fonts.google(apis|static)");
    expect(frame).toContain("compactHeader");
    expect(frame).toContain("ssrCompact");
    expect(frame).not.toContain("width={props.kind === \"header\" && compactHeader ? 412 : 1280}");
  });

  it("moves the open burger list below the close X only at max-width 240px, without wrapping labels", () => {
    expect(WP_SHELL_OPEN_MENU_NARROW_MAX_WIDTH_PX).toBe(240);
    expect(WP_SHELL_OPEN_MENU_NARROW_CSS).toContain(
      `@media screen and (max-width: ${WP_SHELL_OPEN_MENU_NARROW_MAX_WIDTH_PX}px)`,
    );
    expect(WP_SHELL_OPEN_MENU_NARROW_CSS).toContain("body.show-menu header#header nav.menu ul");
    expect(WP_SHELL_OPEN_MENU_NARROW_CSS).toContain("padding-top:");
    expect(WP_SHELL_OPEN_MENU_NARROW_CSS).toContain("white-space: nowrap");
    expect(WP_SHELL_OPEN_MENU_NARROW_CSS).not.toContain("padding-right");
    expect(WP_SHELL_OPEN_MENU_NARROW_CSS).not.toMatch(
      /@media[^{]+max-width:\s*(4\d{2}|[5-9]\d{2}|[1-9]\d{3})px/,
    );
    const frame = readFileSync(path.join(__dirname, "wp-shell-frame.tsx"), "utf8");
    expect(frame).toContain("WP_SHELL_OPEN_MENU_NARROW_CSS");
  });

  it("keeps the header iframe a sized box while compact fonts load (no display:none)", () => {
    const frame = readFileSync(path.join(__dirname, "wp-shell-frame.tsx"), "utf8");
    expect(frame).toContain('display: "block"');
    expect(frame).toContain('? "hidden" : "visible"');
    expect(frame).toContain("compactHeader && !headerRevealed");
    expect(frame).not.toContain(
      'display: props.kind === "header" && compactHeader && !headerRevealed ? "none" : "block"',
    );
  });

  it("posts wp-menu open/close and expands the compact header iframe via data-wp-menu-open", () => {
    const frame = readFileSync(path.join(__dirname, "wp-shell-frame.tsx"), "utf8");
    expect(frame).toContain('post("wp-menu"');
    expect(frame).toContain("WP_SHELL_MENU_OPEN_ATTR");
    expect(frame).toContain('headerMenuOpen ? "true" : "false"');
    expect(frame).toContain("header#header .mobile_menu");
    expect(frame).toContain("wp-menu-close");
  });
});
