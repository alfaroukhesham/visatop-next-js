import { appHref, publicAsset } from "@/lib/app-href";

describe("appHref", () => {
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://visatop.com/visa-processing";
  });

  afterEach(() => {
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
  });

  it("uses no trailing slash for the app home path", () => {
    expect(appHref("/")).toBe("https://visatop.com/visa-processing");
  });

  it("keeps sub-routes unchanged", () => {
    expect(appHref("/sign-in")).toBe("https://visatop.com/visa-processing/sign-in");
    expect(appHref("/apply/start")).toBe("https://visatop.com/visa-processing/apply/start");
  });

  it("does not double-prefix when the path already includes basePath", () => {
    expect(appHref("/visa-processing/apply/link-after-signup")).toBe(
      "https://visatop.com/visa-processing/apply/link-after-signup",
    );
    expect(appHref("/visa-processing")).toBe("https://visatop.com/visa-processing");
  });
});

describe("publicAsset", () => {
  const prevBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    if (prevBasePath === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = prevBasePath;
  });

  it("prefixes a public file with the configured Next basePath", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(publicAsset("/apply/passport-bio-specimen.svg")).toBe(
      "/visa-processing/apply/passport-bio-specimen.svg",
    );
  });

  it("is identical for a path with or without a leading slash", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(publicAsset("apply/passport-bio-specimen.svg")).toBe(
      "/visa-processing/apply/passport-bio-specimen.svg",
    );
  });

  it("does not double-prefix when the path already includes basePath", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(publicAsset("/visa-processing/apply/passport-bio-specimen.svg")).toBe(
      "/visa-processing/apply/passport-bio-specimen.svg",
    );
  });

  it("uses NEXT_PUBLIC_BASE_PATH when set, without a trailing slash", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "visa-staging/";
    expect(publicAsset("/apply/passport-bio-specimen.svg")).toBe(
      "/visa-staging/apply/passport-bio-specimen.svg",
    );
  });
});
