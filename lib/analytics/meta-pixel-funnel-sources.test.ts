import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Meta Pixel funnel sources", () => {
  it("fires StartApplication on the ad deep-link start page with the shared once key", () => {
    const src = read("components/apply/start-application-form.tsx");
    expect(src).toContain("APPLY_FUNNEL_EVENTS.applicationStarted");
    expect(src).toContain("APPLY_FUNNEL_EVENTS.applicationStarted,");
    expect(src).toContain("step_name: \"currency_visa\"");
  });

  it("adds visa name and price value on visa_selected", () => {
    const src = read("components/apply/start-application-form.tsx");
    expect(src).toContain("visa_name: selected.name");
    expect(src).toContain("value: priceMinor / 100");
  });

  it("adds value and currency on Ziina/Fincra apply_payment_started and leaves the Paddle branch unchanged", () => {
    const src = read("components/apply/paddle-checkout-button.tsx");
    expect(src).toContain("liveCheckoutParams({");
    expect(src).toContain('provider: "fincra"');
    expect(src).toContain('provider: "ziina"');
    expect(src).toContain("payment_provider: \"paddle\"");
    expect(src).not.toContain("liveCheckoutParams({ provider: \"paddle\"");
  });

  it("does not load extra marketing scripts or uncomment WhatsApp", () => {
    const pixel = read("components/analytics/meta-pixel.tsx");
    expect(pixel).toContain("strategy=\"lazyOnload\"");
    expect(pixel).toContain("buildMetaPixelBootstrapScript()");
    const wa = read("components/client/sticky-whatsapp-button.tsx");
    expect(wa).toContain("WA-AB-TEST");
    expect(wa).toContain("return null;");
  });
});
