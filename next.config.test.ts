import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("next.config static asset CORS", () => {
  it("allows cross-origin reads of hashed /_next/static assets only", () => {
    const src = read("next.config.ts");

    expect(src).toContain('key: "Access-Control-Allow-Origin", value: "*"');
    expect(src).toContain(
      'key: "Cache-Control", value: "public, max-age=31536000, immutable"',
    );
    expect(src).toContain('source: "/_next/static/:path*"');
    expect(src).toContain("basePath: false");

    const corsBlocks = [...src.matchAll(/Access-Control-Allow-Origin/g)];
    expect(corsBlocks.length).toBe(1);

    expect(src).not.toMatch(
      /source:\s*"\/api\/:path\*"[\s\S]{0,400}Access-Control-Allow-Origin/,
    );
    expect(src).not.toMatch(
      /source:\s*"\/:path\*"[\s\S]{0,200}Access-Control-Allow-Origin/,
    );
    expect(src).not.toMatch(
      /source:\s*"\/admin\/:path\*"[\s\S]{0,200}Access-Control-Allow-Origin/,
    );
  });

  it("does not add or strip CORS on the Caddy reverse proxy (Next serves the files)", () => {
    const deploy = read("scripts/blue-green-deploy.sh");
    const caddyBlock = deploy.slice(
      deploy.indexOf("write_caddyfile()"),
      deploy.indexOf("validate_caddyfile()"),
    );
    expect(caddyBlock).toContain("reverse_proxy ${upstream}:3000");
    expect(caddyBlock).not.toMatch(/Access-Control-Allow-Origin/);
    expect(caddyBlock).not.toMatch(/header_down/);
  });
});
