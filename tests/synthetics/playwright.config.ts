import { defineConfig, devices } from "@playwright/test";

/** Origin only — paths must include Next `basePath` (/visa-processing). */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";

/**
 * Optional apply-flow synthetic for cron / a droplet container.
 * Not part of `pnpm test:e2e`. Run with `pnpm run test:synthetic`.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /apply-to-payment\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 180_000,
  use: {
    baseURL,
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
