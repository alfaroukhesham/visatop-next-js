import { Children, isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { MetaPixel } from "@/components/analytics/meta-pixel";

describe("MetaPixel", () => {
  it("defines the fbq stub afterInteractive and defers fbevents.js to interaction/idle", () => {
    const tree = MetaPixel();
    const script = Children.toArray(tree.props.children).find(
      (child) => isValidElement(child) && child.props.id === "visatop-meta-pixel",
    );
    expect(isValidElement(script)).toBe(true);
    if (!isValidElement(script)) return;
    expect(script.props.strategy).toBe("afterInteractive");
    const html = script.props.dangerouslySetInnerHTML.__html as string;
    expect(html).toContain("pointerdown");
    expect(html).toContain("requestIdleCallback");
    expect(html.indexOf("n.queue=[]")).toBeLessThan(html.indexOf("fbq('track', 'PageView')"));
  });
});
