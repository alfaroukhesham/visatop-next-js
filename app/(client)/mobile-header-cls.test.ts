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
  it("reserves header height only inside a max-width 414px query", () => {
    expect(globals).toContain("@media (max-width: 414px)");
    expect(globals).toContain("--wp-shell-header-height: 118px");
    expect(globals).toContain("min-height: 118px");
    expect(globals).toContain("padding-top: 118px !important");
    expect(layout).toContain("theme-client-wp-header");
    expect(layout).toContain("theme-client-main");
    const withoutMobileQuery = globals.replace(
      /@media \(max-width: 414px\) \{[\s\S]*?\}/,
      "",
    );
    expect(withoutMobileQuery).not.toContain("--wp-shell-header-height: 118px");
  });
});

describe("narrow passport select icon", () => {
  it("hides the globe below 240px and frees left padding", () => {
    expect(combobox).toContain("max-[240px]:hidden");
    expect(combobox).toContain("max-[240px]:pl-3");
  });

  it("lets the compact placeholder wrap below 240px", () => {
    expect(combobox).toContain("max-[240px]:placeholder:whitespace-normal");
    expect(combobox).toContain("break-words whitespace-normal");
    expect(combobox).toContain("max-[240px]:flex");
    expect(combobox).toContain("compactPlaceholder");
  });

  it("pins lucide icon width and height so the SVG circle cannot shift", () => {
    expect(combobox).toContain("width={hero ? 24 : 20}");
    expect(combobox).toContain("height={hero ? 24 : 20}");
  });
});
