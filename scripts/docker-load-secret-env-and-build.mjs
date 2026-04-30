/**
 * Docker BuildKit: read a dotenv-style file from a mounted secret and run `pnpm build`.
 * Usage: docker buildx build --secret id=env,src=.env.local ...
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const secretPath = process.argv[2] ?? "/run/secrets/env";

function applyDotenv(content) {
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\\n/g, "\n");
    process.env[key] = val;
  }
}

let txt;
try {
  txt = readFileSync(secretPath, "utf8");
} catch {
  console.error(
    `Missing or unreadable build secret at ${secretPath}.\n` +
      "Example: docker buildx build --secret id=env,src=.env.local ...",
  );
  process.exit(1);
}

applyDotenv(txt);

const r = spawnSync("pnpm", ["build"], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
