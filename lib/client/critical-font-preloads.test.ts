import { describe, expect, it } from "vitest";
import { criticalFontHrefsFromCss } from "./critical-font-preloads";

const css = `
@font-face{font-family:"Red Hat Text";font-style:normal;font-weight:400;font-display:swap;src:url(../media/redhat400-s.p.abc.woff2)format("woff2");unicode-range:U+??}
@font-face{font-family:"Red Hat Text Fallback";src:local(Arial);size-adjust:107.12%}
@font-face{font-family:"Red Hat Text";font-style:normal;font-weight:600;font-display:swap;src:url(../media/redhat600-s.p.def.woff2)format("woff2")}
@font-face{font-family:Noto Serif;font-style:normal;font-weight:600;font-display:swap;src:url(../media/noto600-s.p.ghi.woff2)format("woff2");unicode-range:U+??}
@font-face{font-family:Noto Serif Fallback;src:local(Times New Roman);size-adjust:118.4%}
`;

describe("criticalFontHrefsFromCss", () => {
  it("preloads only Noto 600 so Red Hat Text does not steal LCP bandwidth", () => {
    expect(criticalFontHrefsFromCss(css)).toEqual([
      "/visa-processing/_next/static/media/noto600-s.p.ghi.woff2",
    ]);
  });
});
