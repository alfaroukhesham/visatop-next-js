import { Children, isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { META_PIXEL_ID, WEBISTE_VISA_PIXEL_ID } from "@/lib/analytics/meta-pixel-id";

describe("MetaPixel", () => {
  it("defers fbevents.js until idle", () => {
    const tree = MetaPixel();
    const script = Children.toArray(tree.props.children).find(
      (child) => isValidElement(child) && child.props.id === "visatop-meta-pixel",
    );
    expect(isValidElement(script)).toBe(true);
    if (!isValidElement(script)) return;
    expect(script.props.strategy).toBe("lazyOnload");
  });

  it("includes noscript PageView hits for both pixels", () => {
    const html = JSON.stringify(MetaPixel());
    expect(html).toContain(`id=${META_PIXEL_ID}`);
    expect(html).toContain(`id=${WEBISTE_VISA_PIXEL_ID}`);
  });
});
