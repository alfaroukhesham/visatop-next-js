import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FINCRA_INLINE_SCRIPT_SRC,
  FINCRA_INLINE_WIDGET_SHA256,
  FINCRA_INLINE_WIDGET_SOURCE_URL,
  FINCRA_INLINE_WIDGET_VERSION,
} from "./fincra-inline";

describe("self-hosted Fincra inline widget", () => {
  it("loads the vendored script from the same origin under basePath", () => {
    expect(FINCRA_INLINE_WIDGET_VERSION).toBe("2.2.0");
    expect(FINCRA_INLINE_WIDGET_SOURCE_URL).toBe(
      "https://unpkg.com/@fincra-engineering/checkout@2.2.0/dist/inline.min.js",
    );
    expect(FINCRA_INLINE_SCRIPT_SRC).toBe("/visa-processing/vendor/fincra-checkout-2.2.0/inline.min.js");
    expect(FINCRA_INLINE_SCRIPT_SRC.startsWith("/")).toBe(true);
    expect(FINCRA_INLINE_SCRIPT_SRC).not.toContain("unpkg");
    expect(FINCRA_INLINE_SCRIPT_SRC).not.toContain("://");
  });

  it("pins the checked-in 2.2.0 bytes to the recorded sha256", () => {
    const bytes = readFileSync("public/vendor/fincra-checkout-2.2.0/inline.min.js");
    expect(bytes.length).toBeGreaterThan(1000);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(FINCRA_INLINE_WIDGET_SHA256);
  });
});
