import { buildHomePageJsonLd } from "@/lib/seo/home-page-json-ld";

describe("buildHomePageJsonLd", () => {
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://visatop.com/visa-processing";
  });

  afterEach(() => {
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
  });

  it("emits Organization, WebSite, WebPage, and Service nodes", () => {
    const json = buildHomePageJsonLd() as {
      "@graph": Array<{ "@type": string; url?: string }>;
    };

    expect(json["@graph"]).toHaveLength(4);
    expect(json["@graph"].map((n) => n["@type"])).toEqual([
      "Organization",
      "WebSite",
      "WebPage",
      "Service",
    ]);
    expect(json["@graph"][2]?.url).toBe("https://visatop.com/visa-processing/");
  });
});
