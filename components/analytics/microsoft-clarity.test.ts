import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MicrosoftClarity } from "@/components/analytics/microsoft-clarity";
import { buildClarityBootstrapScript } from "@/lib/analytics/clarity-bootstrap";

const read = (relativePath: string): string =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("MicrosoftClarity", () => {
  it("skips the script when the project id is empty", () => {
    expect(MicrosoftClarity({ projectId: "" })).toBeNull();
  });

  it("renders next/script lazyOnload with the standard snippet", () => {
    const tree = MicrosoftClarity({ projectId: "waxpllatey" });
    expect(tree).not.toBeNull();
    expect(tree?.props.id).toBe("visatop-clarity");
    expect(tree?.props.strategy).toBe("lazyOnload");
    expect(tree?.props.children).toBe(buildClarityBootstrapScript("waxpllatey"));
  });

  it("does not use id=clarity (conflicts with Clarity's own element)", () => {
    const src = read("components/analytics/microsoft-clarity.tsx");
    expect(src).toMatch(/<Script[\s\S]*?\sid="visatop-clarity"/);
    expect(src).not.toMatch(/<Script[\s\S]*?\sid=["']clarity["']/);
  });
});

describe("MicrosoftClarity wiring", () => {
  it("is mounted from the customer layout only", () => {
    const customerLayout = read("app/(client)/layout.tsx");
    expect(customerLayout).toContain("MicrosoftClarity");
    expect(customerLayout).toContain('from "@/components/analytics/microsoft-clarity"');

    const adminLayout = read("app/admin/layout.tsx");
    expect(adminLayout).not.toContain("MicrosoftClarity");
    expect(adminLayout).not.toContain("clarity");

    const protectedAdminLayout = read("app/admin/(protected)/layout.tsx");
    expect(protectedAdminLayout).not.toContain("MicrosoftClarity");
    expect(protectedAdminLayout).not.toContain("clarity");

    const rootLayout = read("app/layout.tsx");
    expect(rootLayout).not.toContain("MicrosoftClarity");
    expect(rootLayout).not.toContain("clarity.ms");
  });

  it("does not need a CSP update (none is set in next.config or proxy)", () => {
    const nextConfig = read("next.config.ts");
    const proxy = read("proxy.ts");
    expect(nextConfig).not.toMatch(/content-security-policy/i);
    expect(nextConfig).not.toMatch(/script-src/);
    expect(proxy).not.toMatch(/content-security-policy/i);
    expect(proxy).not.toMatch(/script-src/);
  });

  it("masks applicant form, passport, personal-detail, and payment containers", () => {
    expect(read("components/apply/start-application-form.tsx")).toContain('data-clarity-mask="true"');
    expect(read("components/apply/draft/document-upload-slot.tsx")).toContain(
      'data-clarity-mask="true"',
    );
    expect(read("components/apply/draft/applicant-review.tsx")).toMatch(
      /<section[\s\S]*data-clarity-mask="true"/,
    );
    expect(read("components/apply/draft/draft-payment-section.tsx")).toContain(
      'data-clarity-mask="true"',
    );
    expect(read("components/apply/checkout-order-recap.tsx")).toContain('data-clarity-mask="true"');
  });
});
