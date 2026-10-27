import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WP_SHELL_COMPACT_MAX_WIDTH_PX,
  WP_SHELL_COMPACT_HEADER_OVERRIDES_CSS,
  WP_SHELL_DESKTOP_FEATURED_LOGO_CSS,
  sizeWpShellHeaderImages,
  wpShellHeaderCspMeta,
  wpShellStylesheetLinks,
} from "./wp-shell-srcdoc";

const THEME_CSS = "https://visatop.com/wp-content/themes/visa/style.css";
const GOOGLE_FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;700";
const GSTATIC_CSS = "https://fonts.gstatic.com/s/inter/v12.css";
const ICON_CSS = "https://visatop.com/wp-content/plugins/elementor/assets/lib/font-awesome/css/all.min.css";

describe("WP_SHELL_COMPACT_MAX_WIDTH_PX", () => {
  it("matches the 414px header-height breakpoint", () => {
    expect(WP_SHELL_COMPACT_MAX_WIDTH_PX).toBe(414);
  });
});

describe("wpShellStylesheetLinks", () => {
  it("keeps every footer stylesheet, including Google Fonts, with no media gate", () => {
    const html = wpShellStylesheetLinks({
      cssUrls: [THEME_CSS, GOOGLE_FONTS, GSTATIC_CSS, ICON_CSS],
      kind: "footer",
    });
    expect(html).toContain(`href="${THEME_CSS}"`);
    expect(html).toContain(`href="${GOOGLE_FONTS}"`);
    expect(html).toContain(`href="${GSTATIC_CSS}"`);
    expect(html).toContain(`href="${ICON_CSS}"`);
    expect(html).not.toContain("media=");
  });

  it("does not drop header Google Fonts and only loads them above 414px", () => {
    const html = wpShellStylesheetLinks({
      cssUrls: [THEME_CSS, GOOGLE_FONTS, ICON_CSS],
      kind: "header",
    });
    expect(html).toContain(`href="${THEME_CSS}"`);
    expect(html).toContain(`href="${ICON_CSS}"`);
    expect(html).toContain(`href="${GOOGLE_FONTS}"`);
    expect(html).toContain(
      `<link rel="stylesheet" href="${GOOGLE_FONTS}" media="screen and (min-width: 415px)">`,
    );
    expect(html).toContain(`<link rel="stylesheet" href="${THEME_CSS}">`);
    expect(html).not.toMatch(
      new RegExp(`href="${THEME_CSS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" media=`),
    );
  });
});

describe("wpShellHeaderCspMeta", () => {
  it("blocks header fonts only in the compact (<=414px) iframe", () => {
    expect(wpShellHeaderCspMeta({ kind: "header", compactHeader: true })).toContain(
      "font-src 'none'",
    );
    expect(wpShellHeaderCspMeta({ kind: "header", compactHeader: false })).toBe("");
    expect(wpShellHeaderCspMeta({ kind: "footer", compactHeader: true })).toBe("");
  });
});

describe("WP_SHELL_COMPACT_HEADER_OVERRIDES_CSS", () => {
  it("scopes the #53 logo, featured, and system-font locks to max-width 414px", () => {
    const css = WP_SHELL_COMPACT_HEADER_OVERRIDES_CSS;
    expect(css).toContain(`@media (max-width: ${WP_SHELL_COMPACT_MAX_WIDTH_PX}px)`);
    expect(css).toContain("header#header .logo img");
    expect(css).toContain("width: 180px");
    expect(css).toContain("height: 40px");
    expect(css).toContain("header#header .featured_on .inner a img");
    expect(css).toContain("width: 64px");
    expect(css).toContain("max-width: 64px");
    expect(css).toContain("filter: brightness(0) invert(1)");
    expect(css).toContain("font-family:Inter");
    expect(css).toContain("src:local(\"Arial\")");
    expect(css).toContain("font-family:ui-sans-serif,system-ui,sans-serif !important");
    expect(css).not.toMatch(/@media[^{]+max-width:\s*(767|991)px/);
  });

  it("is injected after the prod featured-logo rules so 64×16 wins at 414px", () => {
    const frame = readFileSync(
      path.join(__dirname, "wp-shell-frame.tsx"),
      "utf8",
    );
    const desktopAt = frame.indexOf("? WP_SHELL_DESKTOP_FEATURED_LOGO_CSS");
    const compactAt = frame.indexOf("? WP_SHELL_COMPACT_HEADER_OVERRIDES_CSS");
    expect(desktopAt).toBeGreaterThan(0);
    expect(compactAt).toBeGreaterThan(desktopAt);
  });
});

describe("WP_SHELL_DESKTOP_FEATURED_LOGO_CSS", () => {
  it("keeps prod #50 featured-logo rules (height 16, width auto) outside the mobile lock", () => {
    expect(WP_SHELL_DESKTOP_FEATURED_LOGO_CSS).toContain("header#header .featured_on .inner a img");
    expect(WP_SHELL_DESKTOP_FEATURED_LOGO_CSS).toContain("height: 16px");
    expect(WP_SHELL_DESKTOP_FEATURED_LOGO_CSS).toContain("width: auto");
    expect(WP_SHELL_DESKTOP_FEATURED_LOGO_CSS).toContain("max-width: 100%");
    expect(WP_SHELL_DESKTOP_FEATURED_LOGO_CSS).toContain("filter: brightness(0) invert(1)");
    expect(WP_SHELL_DESKTOP_FEATURED_LOGO_CSS).not.toContain("width: 64px");
    expect(WP_SHELL_DESKTOP_FEATURED_LOGO_CSS).not.toContain("@media");
  });
});

describe("sizeWpShellHeaderImages", () => {
  const html =
    '<a class="logo"><img alt="VisaTop" src="/logo.png"></a><a class="featured"><img alt="Khaleej Times" src="/kt.png"></a>';

  it("stamps 180×40 / 64×16 only for the compact header", () => {
    const sized = sizeWpShellHeaderImages(html, true);
    expect(sized).toContain('width="180"');
    expect(sized).toContain('height="40"');
    expect(sized).toContain('width="64"');
    expect(sized).toContain('height="16"');
    expect(sizeWpShellHeaderImages(html, false)).toBe(html);
  });
});
