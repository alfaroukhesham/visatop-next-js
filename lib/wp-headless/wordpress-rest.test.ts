import { describe, expect, it } from "vitest";
import { buildWordpressRestCandidateUrls } from "./wordpress-rest";

describe("buildWordpressRestCandidateUrls", () => {
  it("tries pretty /wp-json/ then rest_route with the same query", () => {
    const urls = buildWordpressRestCandidateUrls({
      wpOrigin: "https://visatop.com",
      route: "/headless/v1/layout",
      searchParams: { include: "menus,css,html", lang: "tr" },
    });
    expect(urls).toEqual([
      "https://visatop.com/wp-json/headless/v1/layout?include=menus%2Ccss%2Chtml&lang=tr",
      "https://visatop.com/?rest_route=%2Fheadless%2Fv1%2Flayout&include=menus%2Ccss%2Chtml&lang=tr",
    ]);
  });
});
