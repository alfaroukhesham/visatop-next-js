import { safeCallbackUrl } from "./safe-callback-url";

describe("safeCallbackUrl", () => {
  it("keeps a Next app path without basePath", () => {
    expect(safeCallbackUrl("/apply/link-after-signup")).toBe("/apply/link-after-signup");
  });

  it("strips a duplicated Next basePath so router.push does not prefix twice", () => {
    expect(safeCallbackUrl("/visa-processing/apply/link-after-signup")).toBe(
      "/apply/link-after-signup",
    );
  });

  it("keeps query strings after stripping basePath", () => {
    expect(safeCallbackUrl("/visa-processing/apply/link-after-signup?ok=1")).toBe(
      "/apply/link-after-signup?ok=1",
    );
  });

  it("rejects a path that becomes protocol-relative after stripping basePath", () => {
    expect(safeCallbackUrl("/visa-processing//evil.example/phish")).toBe("/portal/track");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeCallbackUrl("//evil.example/phish")).toBe("/portal/track");
  });

  it("rejects non-relative URLs", () => {
    expect(safeCallbackUrl("https://evil.example/phish")).toBe("/portal/track");
  });
});
