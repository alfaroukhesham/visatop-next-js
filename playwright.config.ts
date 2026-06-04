import { defineConfig, devices } from "@playwright/test";

/** Origin only — paths must include Next `basePath` (/visa-processing). */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";


/**
 * Cross-browser smoke tests (Chromium, Firefox, WebKit ≈ Chrome, Firefox, Safari).
 *
 * Local (production build):
 *   pnpm run build && pnpm run start
 *   pnpm run test:e2e
 *
 * Against deployed prod/staging:
 *   PLAYWRIGHT_BASE_URL=https://visatop.com pnpm run test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
