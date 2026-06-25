import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://visatop.com/visa-processing";
  });

  afterEach(() => {
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
  });

  it("lists public indexable routes under the app base path", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual([
      "https://visatop.com/visa-processing/",
      "https://visatop.com/visa-processing/sign-in",
      "https://visatop.com/visa-processing/sign-up",
      "https://visatop.com/visa-processing/apply/track",
    ]);
  });
});
