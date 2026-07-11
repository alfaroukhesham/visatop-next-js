import { appHref } from "@/lib/app-href";

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
});
