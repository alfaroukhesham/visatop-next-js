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
  it("reserves 118px header offset before the iframe posts its height", () => {
    expect(globals).toContain("--wp-shell-header-height: 118px");
    expect(globals).toContain("min-height: 118px");
    expect(globals).toContain("height: 118px !important");
    expect(globals).toContain("padding-top: 118px !important");
    expect(globals).toContain("@media (max-width: 767px)");
    expect(layout).toContain("paddingTop: 118");
    expect(layout).toContain("--wp-shell-header-height");
    expect(layout).toContain("theme-client-wp-header");
    expect(layout).toContain("theme-client-main");
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
