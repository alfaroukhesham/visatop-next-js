import { describe, expect, it } from "vitest";
import { sanitizeWpShellHtml } from "./sanitize-wp-html";

describe("sanitizeWpShellHtml", () => {
  it("keeps the footer VisaTop img and loads it eagerly so lazy-loading cannot skip it off-screen", () => {
    const html = sanitizeWpShellHtml(
      `<div class="logo"><a href="https://visatop.com/"><img loading="lazy" decoding="async" src="https://visatop.com/wp-content/uploads/2025/11/cropped-VisaTop-Photoroom.png" alt="VisaTop"></a></div>`,
    );
    expect(html).toContain(
      'src="https://visatop.com/wp-content/uploads/2025/11/cropped-VisaTop-Photoroom.png"',
    );
    expect(html).toContain('alt="VisaTop"');
    expect(html).toContain('loading="eager"');
    expect(html).not.toContain('loading="lazy"');
  });

  it("unwraps picture/source so the img src still loads in the srcdoc iframe", () => {
    const html = sanitizeWpShellHtml(
      `<picture><source srcset="https://visatop.com/logo.webp" type="image/webp"><img src="https://visatop.com/logo.png" alt="VisaTop"></picture>`,
    );
    expect(html).toContain('src="https://visatop.com/logo.png"');
    expect(html).not.toContain("<picture");
    expect(html).not.toContain("<source");
  });
});
