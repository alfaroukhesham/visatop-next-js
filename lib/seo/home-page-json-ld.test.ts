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

  it("emits page-specific nodes and references Yoast site entities by @id", () => {
    const json = buildHomePageJsonLd() as {
      "@graph": Array<Record<string, unknown>>;
    };

    expect(json["@graph"]).toHaveLength(3);
    expect(json["@graph"].map((n) => n["@type"])).toEqual([
      "WebPage",
      "BreadcrumbList",
      "Service",
    ]);

    const webPage = json["@graph"][0];
    expect(webPage.url).toBe("https://visatop.com/visa-processing");
    expect(webPage.isPartOf).toEqual({ "@id": "https://visatop.com/#website" });
    expect(webPage.about).toEqual({
      "@id": "https://visatop.com/visa-processing#service",
    });
    expect(webPage.breadcrumb).toEqual({
      "@id": "https://visatop.com/visa-processing#breadcrumb",
    });
    expect(webPage.speakable).toEqual({
      "@type": "SpeakableSpecification",
      cssSelector: ["#service-facts"],
    });

    const breadcrumb = json["@graph"][1];
    expect(breadcrumb.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "VisaTop",
        item: "https://visatop.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Apply for UAE Tourist Visa Online",
        item: "https://visatop.com/visa-processing",
      },
    ]);

    const service = json["@graph"][2];
    expect(service.provider).toEqual({ "@id": "https://visatop.com/#organization" });
    expect(service.offers).toMatchObject({
      "@type": "Offer",
      url: "https://visatop.com/visa-processing",
      availability: "https://schema.org/InStock",
      priceCurrency: "USD",
    });

    for (const node of json["@graph"]) {
      expect(node.name).not.toBe("Visatop");
    }

    expect(json["@graph"].some((n) => n["@type"] === "Organization")).toBe(false);
    expect(json["@graph"].some((n) => n["@type"] === "WebSite")).toBe(false);
  });
});
