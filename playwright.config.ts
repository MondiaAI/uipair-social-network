import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for UiPair E2E tests.
 *
 * Set BASE_URL to the preview / published / local URL you want to test.
 * Defaults to local dev server on http://localhost:5173.
 *
 * Optional env vars:
 *   E2E_OLD_EMAIL / E2E_OLD_PASSWORD  – credentials for an existing (old) account
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
