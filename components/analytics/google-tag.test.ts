import { Children, isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { GoogleTag } from "@/components/analytics/google-tag";
import { buildGoogleTagBootstrapScript } from "@/lib/analytics/gtag-bootstrap";

const childById = (tree: ReturnType<typeof GoogleTag>, id: string) => {
  const match = Children.toArray(tree.props.children).find(
    (child) => isValidElement(child) && child.props.id === id,
  );
  return isValidElement(match) ? match : null;
};

describe("GoogleTag", () => {
  it("keeps the tiny consent bootstrap afterInteractive so events can queue", () => {
    const tree = GoogleTag({ googleTagId: "GT-TEST" });
    const bootstrap = childById(tree, "visatop-gtag-consent");
    expect(bootstrap).not.toBeNull();
    expect(bootstrap?.props.strategy).toBe("afterInteractive");
    expect(bootstrap?.props.dangerouslySetInnerHTML.__html).toBe(
      buildGoogleTagBootstrapScript({ googleTagId: "GT-TEST" }),
    );
  });

  it("defers the remote gtag.js to first interaction or load + idle", () => {
    const tree = GoogleTag({ googleTagId: "GT-TEST" });
    const loader = childById(tree, "visatop-gtag-loader");
    expect(loader).not.toBeNull();
    expect(loader?.props.strategy).toBe("afterInteractive");
    const html = loader?.props.dangerouslySetInnerHTML.__html as string;
    expect(html).toContain("googletagmanager.com/gtag/js?id=GT-TEST");
    expect(html).toContain('"visatop-gtag"');
    expect(html).toContain("pointerdown");
    expect(html).toContain("requestIdleCallback");
  });
});
