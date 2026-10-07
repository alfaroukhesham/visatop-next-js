#!/usr/bin/env node
/**
 * Fail CI if the HEIC WASM decoder is missing from standalone output or cannot
 * decode a real HEIC to JPEG when loaded from that tree (not the repo).
 *
 * Same class of bug as the PDF worker: NFT / outputFileTracingIncludes can drop
 * files, and under pnpm heic-decode + libheif-js are not top-level packages.
 * Docker copies `.next/standalone` to `/app`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const standalone = path.join(repoRoot, ".next/standalone");
const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "tiny-still.heic",
);

if (!existsSync(standalone)) {
  console.error("assert-heic-standalone: .next/standalone is missing. Run `pnpm run build` first.");
  process.exit(1);
}
if (!existsSync(fixturePath)) {
  console.error(`assert-heic-standalone: HEIC fixture missing at ${fixturePath}`);
  process.exit(1);
}

const findNames = (dir, name) => {
  const found = execFileSync("find", [dir, "-name", name], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  return found;
};

const wasmBundle = findNames(standalone, "wasm-bundle.js").filter((p) =>
  p.includes(`${path.sep}libheif-js${path.sep}`),
);
const heifBundle = findNames(standalone, "libheif-bundle.js");
const heifWasm = findNames(standalone, "libheif.wasm");

if (wasmBundle.length === 0 || heifBundle.length === 0) {
  console.error(
    "assert-heic-standalone: libheif-js wasm-bundle.js / libheif-bundle.js were not copied into .next/standalone.\n" +
      "Under pnpm those packages live in node_modules/.pnpm/libheif-js@*/..., not ./node_modules/libheif-js.\n" +
      "Check next.config.ts outputFileTracingIncludes.",
  );
  process.exit(1);
}
if (heifWasm.length === 0) {
  console.error(
    "assert-heic-standalone: libheif.wasm was not copied into .next/standalone (Docker image path would also be missing).",
  );
  process.exit(1);
}

const dockerPath = (abs) => `/app/${path.relative(standalone, abs)}`;
for (const abs of [...wasmBundle, ...heifBundle, ...heifWasm]) {
  if (!abs.startsWith(standalone + path.sep)) continue;
  console.log(`assert-heic-standalone: Docker image path → ${dockerPath(abs)}`);
}

const hashedParent = path.join(standalone, ".next/node_modules");
const hashedDirs = existsSync(hashedParent)
  ? execFileSync("find", [hashedParent, "-maxdepth", "1", "-name", "heic-convert-*"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean)
  : [];

const pnpmRoot = path.join(standalone, "node_modules/.pnpm");
const pnpmConvert = existsSync(pnpmRoot)
  ? execFileSync("find", [pnpmRoot, "-path", "*/node_modules/heic-convert/index.js"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean)
  : [];

const convertEntry = hashedDirs[0]
  ? hashedDirs[0]
  : pnpmConvert[0]
    ? path.dirname(pnpmConvert[0])
    : null;

if (!convertEntry) {
  console.error(
    "assert-heic-standalone: heic-convert is missing from .next/standalone (.next/node_modules/heic-convert-* or .pnpm store).",
  );
  process.exit(1);
}

const standaloneRoot = path.resolve(standalone);
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveInsideStandalone(request, parent, isMain, options) {
  const resolved = originalResolve.call(this, request, parent, isMain, options);
  const pkg = request.startsWith("node:") ? request.slice(5) : request.split("/")[0];
  if (request.startsWith("node:") || Module.builtinModules.includes(pkg)) {
    return resolved;
  }
  const abs = path.resolve(resolved.split("?")[0]);
  if (abs === fixturePath || abs.startsWith(standaloneRoot + path.sep)) {
    return resolved;
  }
  throw new Error(
    `assert-heic-standalone: ${request} resolved to ${abs}, outside .next/standalone.\n` +
      "The decoder must load from the standalone tree (what Docker COPY uses), not the repo node_modules.",
  );
};

const require = Module.createRequire(path.join(path.resolve(convertEntry), "package.json"));
let convert;
try {
  convert = require(path.resolve(convertEntry));
} catch (err) {
  console.error(
    "assert-heic-standalone: failed to load heic-convert from standalone.\n" +
      `entry: ${convertEntry}\n` +
      (err instanceof Error ? err.message : String(err)),
  );
  process.exit(1);
}

if (typeof convert !== "function") {
  const inner =
    convert && typeof convert === "object" && typeof convert.default === "function"
      ? convert.default
      : null;
  if (!inner) {
    console.error("assert-heic-standalone: standalone heic-convert is not a function");
    process.exit(1);
  }
  convert = inner;
}

const heic = readFileSync(fixturePath);
if (heic.length < 12 || heic[4] !== 0x66 || heic[5] !== 0x74 || heic[6] !== 0x79 || heic[7] !== 0x70) {
  console.error("assert-heic-standalone: fixture is not an ISO-BMFF HEIC (missing ftyp).");
  process.exit(1);
}

let jpeg;
try {
  const output = await convert({ buffer: heic, format: "JPEG", quality: 0.85 });
  jpeg = Buffer.from(new Uint8Array(output));
} catch (err) {
  console.error(
    "assert-heic-standalone: standalone decoder failed to convert the HEIC fixture to JPEG.\n" +
      (err instanceof Error ? err.message : String(err)),
  );
  process.exit(1);
}

if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
  console.error(
    `assert-heic-standalone: expected JPEG SOI, got ${jpeg.length} bytes starting ${jpeg.subarray(0, 4).toString("hex")}`,
  );
  process.exit(1);
}

console.log(
  `assert-heic-standalone: decoded ${heic.length}B HEIC → ${jpeg.length}B JPEG using\n` +
    `${path.resolve(convertEntry)}\n` +
    `(imported via ${pathToFileURL(path.resolve(convertEntry)).href}, not repo node_modules)`,
);
