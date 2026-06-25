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

  it("emits only page-specific nodes and references Yoast site entities by @id", () => {
    const json = buildHomePageJsonLd() as {
      "@graph": Array<Record<string, unknown>>;
    };

    expect(json["@graph"]).toHaveLength(2);
    expect(json["@graph"].map((n) => n["@type"])).toEqual(["WebPage", "Service"]);

    const webPage = json["@graph"][0];
    expect(webPage.url).toBe("https://visatop.com/visa-processing/");
    expect(webPage.isPartOf).toEqual({ "@id": "https://visatop.com/#website" });
    expect(webPage.about).toEqual({
      "@id": "https://visatop.com/visa-processing/#service",
    });

    const service = json["@graph"][1];
    expect(service.provider).toEqual({ "@id": "https://visatop.com/#organization" });

    for (const node of json["@graph"]) {
      expect(node.name).not.toBe("Visatop");
    }

    expect(json["@graph"].some((n) => n["@type"] === "Organization")).toBe(false);
    expect(json["@graph"].some((n) => n["@type"] === "WebSite")).toBe(false);
  });
});
