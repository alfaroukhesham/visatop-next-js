import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Load from project root (not process.cwd()) so migrate matches scripts + Neon CLI.
config({ path: resolve(projectRoot, ".env") });
config({ path: resolve(projectRoot, ".env.local"), override: true });

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL_DIRECT (preferred) or DATABASE_URL is missing. Set it in `.env` or `.env.local` (see `.env.example`).",
  );
}

export default defineConfig({
  schema: "./lib/db/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
