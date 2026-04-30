import { describe, expect, it } from "vitest";
import { allowlistWpCssUrls } from "./allowlist-css";

describe("allowlistWpCssUrls", () => {
  it("keeps only https urls on allowlisted hosts and dedupes", () => {
    const out = allowlistWpCssUrls(
      [
        "https://wp.visatop.com/wp-content/themes/site.css",
        "https://wp.visatop.com/wp-content/themes/site.css",
        "http://wp.visatop.com/insecure.css",
        "https://evil.example.com/x.css",
        "not-a-url",
      ],
      { allowedHosts: ["wp.visatop.com"] }
    );

    expect(out).toEqual(["https://wp.visatop.com/wp-content/themes/site.css"]);
  });

  it("accepts multiple allowed hosts", () => {
    const out = allowlistWpCssUrls(
      [
        "https://cdn.visatop.com/a.css",
        "https://wp.visatop.com/b.css",
        "https://www.visatop.com/c.css",
      ],
      { allowedHosts: ["cdn.visatop.com", "wp.visatop.com"] }
    );

    expect(out).toEqual(["https://cdn.visatop.com/a.css", "https://wp.visatop.com/b.css"]);
  });
});

