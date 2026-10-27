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

  it("defers the remote gtag.js until idle", () => {
    const tree = GoogleTag({ googleTagId: "GT-TEST" });
    const remote = childById(tree, "visatop-gtag");
    expect(remote).not.toBeNull();
    expect(remote?.props.strategy).toBe("lazyOnload");
    expect(remote?.props.src).toContain("googletagmanager.com/gtag/js");
  });
});
