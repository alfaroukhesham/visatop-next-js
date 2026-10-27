import { Children, isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { MetaPixel } from "@/components/analytics/meta-pixel";

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
});
