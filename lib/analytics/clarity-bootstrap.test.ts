import { describe, expect, it } from "vitest";
import { buildClarityBootstrapScript } from "@/lib/analytics/clarity-bootstrap";

describe("buildClarityBootstrapScript", () => {
  it("emits the standard Clarity tag loader with the project id", () => {
    const script = buildClarityBootstrapScript("waxpllatey");
    expect(script).toContain('t.src="https://www.clarity.ms/tag/"+i');
    expect(script).toContain('"clarity"');
    expect(script).toContain('"waxpllatey"');
    expect(script).toContain("window, document, \"clarity\", \"script\"");
  });

  it("JSON-encodes the project id", () => {
    const script = buildClarityBootstrapScript('x");alert(1);//');
    expect(script).toContain(JSON.stringify('x");alert(1);//'));
    expect(script).not.toContain('x");alert(1);//');
  });
});
