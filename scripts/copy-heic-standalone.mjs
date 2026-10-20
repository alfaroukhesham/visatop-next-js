#!/usr/bin/env node
/**
 * Next standalone tracing plus pnpm nested node_modules can drop HEIC decoder
 * files. NFT tries to mkdir .pnpm/heic-convert@ver/node_modules/heic-decode
 * (a symlink in the real tree). That race ENOENT is a warning, the build still
 * exits 0, and Docker then ships a tree without libheif-js WASM.
 *
 * Copy the real package directories into standalone/node_modules/pkg
 * (and fill any nested pnpm sibling slots) so require() and relative WASM
 * loads work regardless of tracing order.
 */
import { createRequire } from "node:module";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const HEIC_RUNTIME_PACKAGES = [
  "heic-convert",
  "heic-decode",
  "libheif-js",
  "jpeg-js",
  "pngjs",
];

const require = createRequire(import.meta.url);

const isMain = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;

const resolvePkgRoot = (name, fromDirs) => {
  const pkgJson = require.resolve(name + "/package.json", fromDirs ? { paths: fromDirs } : undefined);
  return path.dirname(realpathSync(pkgJson));
};

export const resolveHeicPackageRoots = (fromDir = process.cwd()) => {
  const convertRoot = resolvePkgRoot("heic-convert", [fromDir]);
  const decodeRoot = resolvePkgRoot("heic-decode", [convertRoot, fromDir]);
  const libheifRoot = resolvePkgRoot("libheif-js", [decodeRoot, convertRoot, fromDir]);
  const jpegRoot = resolvePkgRoot("jpeg-js", [convertRoot, fromDir]);
  const pngRoot = resolvePkgRoot("pngjs", [convertRoot, fromDir]);
  return {
    "heic-convert": convertRoot,
    "heic-decode": decodeRoot,
    "libheif-js": libheifRoot,
    "jpeg-js": jpegRoot,
    pngjs: pngRoot,
  };
};

const copyTree = (src, dest) => {
  if (existsSync(dest)) {
    const st = lstatSync(dest);
    if (st.isSymbolicLink() || st.isFile()) {
      rmSync(dest, { force: true });
    } else {
      rmSync(dest, { recursive: true, force: true });
    }
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true, dereference: true, force: true });
};

const nestedNodeModulesDirs = (standalone, pkgName) => {
  const pnpm = path.join(standalone, "node_modules", ".pnpm");
  if (!existsSync(pnpm)) return [];
  const found = [];
  for (const entry of readdirSync(pnpm, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (!entry.name.startsWith(pkgName + "@")) continue;
    const nm = path.join(pnpm, entry.name, "node_modules");
    if (existsSync(nm)) found.push(nm);
  }
  return found;
};

export const copyHeicDecoderIntoStandalone = ({
  repoRoot = process.cwd(),
  standaloneRoot = path.join(process.cwd(), ".next/standalone"),
} = {}) => {
  if (!existsSync(standaloneRoot)) {
    throw new Error("copy-heic-standalone: " + standaloneRoot + " is missing. Run next build first.");
  }
  const roots = resolveHeicPackageRoots(repoRoot);
  const copied = {};
  for (const name of HEIC_RUNTIME_PACKAGES) {
    const dest = path.join(standaloneRoot, "node_modules", name);
    copyTree(roots[name], dest);
    copied[name] = dest;
  }

  const convertSlots = nestedNodeModulesDirs(standaloneRoot, "heic-convert");
  for (const slot of convertSlots) {
    copyTree(roots["heic-decode"], path.join(slot, "heic-decode"));
    copyTree(roots["jpeg-js"], path.join(slot, "jpeg-js"));
    copyTree(roots.pngjs, path.join(slot, "pngjs"));
  }
  const decodeSlots = nestedNodeModulesDirs(standaloneRoot, "heic-decode");
  for (const slot of decodeSlots) {
    copyTree(roots["libheif-js"], path.join(slot, "libheif-js"));
  }
  return { copied, roots };
};

if (isMain) {
  try {
    const result = copyHeicDecoderIntoStandalone();
    for (const [name, dest] of Object.entries(result.copied)) {
      console.log("copy-heic-standalone: " + name + " -> " + dest);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
