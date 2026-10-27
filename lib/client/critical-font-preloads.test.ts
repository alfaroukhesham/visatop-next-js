import { describe, expect, it } from "vitest";
import { criticalFontHrefsFromCss } from "./critical-font-preloads";

const css = `
@font-face{font-family:Inter;font-style:normal;font-weight:400;font-display:swap;src:url(../media/inter400-s.p.abc.woff2)format("woff2");unicode-range:U+??}
@font-face{font-family:Inter Fallback;src:local(Arial);size-adjust:107.12%}
@font-face{font-family:Inter;font-style:normal;font-weight:500;font-display:swap;src:url(../media/inter500-s.p.def.woff2)format("woff2")}
@font-face{font-family:Noto Serif;font-style:normal;font-weight:600;font-display:swap;src:url(../media/noto600-s.p.ghi.woff2)format("woff2");unicode-range:U+??}
@font-face{font-family:Noto Serif Fallback;src:local(Times New Roman);size-adjust:118.4%}
`;

describe("criticalFontHrefsFromCss", () => {
  it("preloads only Inter 400 and Noto 600 latin files", () => {
    expect(criticalFontHrefsFromCss(css)).toEqual([
      "/visa-processing/_next/static/media/inter400-s.p.abc.woff2",
      "/visa-processing/_next/static/media/noto600-s.p.ghi.woff2",
    ]);
  });
});
