import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load `.env` first, then let `.env.local` override (matches common Next.js expectations).
config({ path: ".env" });
config({ path: ".env.local", override: true });

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
