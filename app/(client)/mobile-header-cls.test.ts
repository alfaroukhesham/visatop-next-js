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
    expect(globals).toContain("min-height: 107px");
    expect(layout).toContain("theme-client-wp-header");
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
});
