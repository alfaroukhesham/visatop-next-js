import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const globals = readFileSync(path.join(__dirname, "../globals.css"), "utf8");
const layout = readFileSync(path.join(__dirname, "layout.tsx"), "utf8");
const combobox = readFileSync(
  path.join(__dirname, "../../components/client/nationality-combobox.tsx"),
  "utf8",
);

describe("mobile WP header CLS reservation", () => {
  it("reserves 130px on desktop and keeps the 118px mobile offset at 414px and below", () => {
    expect(globals).toContain("--wp-shell-header-height: 130px");
    expect(globals).toContain("padding-top: 130px");
    expect(globals).toContain("@media (max-width: 414px)");
    expect(globals).toContain("--wp-shell-header-height: 118px");
    expect(globals).toContain("min-height: 118px !important");
    expect(globals).toContain("height: 118px !important");
    expect(globals).toContain("padding-top: 118px !important");
    expect(layout).toContain("paddingTop: 130");
    expect(layout).toContain("--wp-shell-header-height:130px");
    expect(layout).toContain("@media (max-width:414px)");
    expect(layout).toContain("theme-client-wp-header");
    expect(layout).toContain("theme-client-main");
    expect(layout).toContain("ssrCompact={ssrCompact}");
    expect(layout).toContain("isCompactWpShellUserAgent");
  });

  it("gives the header iframe explicit width and height above 414px so unsized-media CLS stays 0", () => {
    expect(globals).toContain(".theme-client-wp-header iframe[data-wp-shell=\"header\"]");
    expect(globals).toMatch(
      /\.theme-client-wp-header iframe\[data-wp-shell="header"\][^{]*\{[^}]*height:\s*130px/,
    );
    expect(globals).toMatch(
      /\.theme-client-wp-header iframe\[data-wp-shell="header"\][^{]*\{[^}]*width:\s*100%/,
    );
    expect(layout).toContain(
      ".theme-client-wp-header iframe[data-wp-shell=header]{min-height:130px;height:130px;width:100%}",
    );
  });

  it("does not lock the header iframe to 118px while the burger menu is open at 414px", () => {
    expect(globals).toContain('iframe[data-wp-shell="header"]:not([data-wp-menu-open="true"])');
    expect(globals).toContain('iframe[data-wp-shell="header"][data-wp-menu-open="true"]');
    expect(globals).toContain("height: 100dvh !important");
    expect(globals).toContain("width: 100vw !important");
    expect(globals).toContain("inset: 0 !important");
    expect(layout).toContain("WP_SHELL_COMPACT_MENU_OPEN_CSS");
  });
});

describe("narrow passport select icon", () => {
  it("hides the globe below 240px and frees left padding", () => {
    expect(combobox).toContain("max-[240px]:hidden");
    expect(combobox).toContain("max-[240px]:pl-3");
  });

  it("lets the compact placeholder wrap at max-width 240px inclusive", () => {
    expect(combobox).toContain("data-nationality-compact-overlay");
    expect(combobox).toContain("compactPlaceholder");
    expect(combobox).toContain("break-words whitespace-normal");
    expect(globals).toContain("@media (max-width: 240px)");
    expect(globals).toContain("[data-nationality-compact-overlay]");
    expect(globals).toContain("display: flex !important");
  });

  it("pins lucide icon width and height so the SVG circle cannot shift", () => {
    expect(combobox).toContain("width={hero ? 24 : 20}");
    expect(combobox).toContain("height={hero ? 24 : 20}");
  });
});
