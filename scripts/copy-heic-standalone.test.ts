import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  HEIC_RUNTIME_PACKAGES,
  copyHeicDecoderIntoStandalone,
  resolveHeicPackageRoots,
} from "./copy-heic-standalone.mjs";

const temps: string[] = [];
const tmp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "heic-standalone-"));
  temps.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("copyHeicDecoderIntoStandalone", () => {
  it("is wired into the production build so Docker/CI cannot skip the copy", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: { build: string } };
    expect(pkg.scripts.build).toMatch(/copy-heic-standalone\.mjs/);
  });

  it("resolves heic-convert and its pnpm-nested decoder packages from the repo", () => {
    const roots = resolveHeicPackageRoots(process.cwd());
    for (const name of HEIC_RUNTIME_PACKAGES) {
      expect(existsSync(path.join(roots[name], "package.json")), name).toBe(true);
    }
  });

  it("copies libheif WASM into a standalone tree even when Next tracing left it empty", () => {
    const standalone = path.join(tmp(), "standalone");
    mkdirSync(standalone, { recursive: true });
    copyHeicDecoderIntoStandalone({ repoRoot: process.cwd(), standaloneRoot: standalone });

    const libheif = path.join(standalone, "node_modules", "libheif-js");
    expect(existsSync(path.join(libheif, "wasm-bundle.js"))).toBe(true);
    expect(existsSync(path.join(libheif, "libheif-wasm", "libheif-bundle.js"))).toBe(true);
    expect(existsSync(path.join(libheif, "libheif-wasm", "libheif.wasm"))).toBe(true);
    expect(existsSync(path.join(standalone, "node_modules", "heic-convert", "package.json"))).toBe(
      true,
    );
  });

  it("repairs a nested pnpm heic-decode slot that Next failed to mkdir", () => {
    const standalone = path.join(tmp(), "standalone");
    const slot = path.join(
      standalone,
      "node_modules",
      ".pnpm",
      "heic-convert@2.1.0",
      "node_modules",
    );
    mkdirSync(slot, { recursive: true });
    writeFileSync(path.join(slot, "placeholder"), "");
    copyHeicDecoderIntoStandalone({ repoRoot: process.cwd(), standaloneRoot: standalone });
    expect(existsSync(path.join(slot, "heic-decode", "package.json"))).toBe(true);
    expect(existsSync(path.join(slot, "jpeg-js", "package.json"))).toBe(true);
  });

  it("loads heic-convert from the copied tree and decodes the HEIC fixture", async () => {
    const standalone = path.join(tmp(), "standalone");
    mkdirSync(standalone, { recursive: true });
    copyHeicDecoderIntoStandalone({ repoRoot: process.cwd(), standaloneRoot: standalone });
    const convertEntry = path.join(standalone, "node_modules", "heic-convert");
    const require = createRequire(path.join(convertEntry, "package.json"));
    const loaded: unknown = require(convertEntry);
    const convert =
      typeof loaded === "function"
        ? loaded
        : typeof loaded === "object" &&
            loaded !== null &&
            "default" in loaded &&
            typeof (loaded as { default: unknown }).default === "function"
          ? (loaded as { default: (input: unknown) => Promise<ArrayBuffer> }).default
          : null;
    expect(typeof convert).toBe("function");
    const fixture = path.join(process.cwd(), "scripts", "fixtures", "tiny-still.heic");
    const heic = readFileSync(fixture);
    const jpeg = Buffer.from(new Uint8Array(await convert!({ buffer: heic, format: "JPEG", quality: 0.85 })));
    expect(jpeg[0]).toBe(0xff);
    expect(jpeg[1]).toBe(0xd8);
  });
});
