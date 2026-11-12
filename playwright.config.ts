import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke tests against a running app (CI: the production build on :3000 with the
 * sample data loaded; locally: E2E_BASE_URL=http://localhost:3107 pnpm test:e2e).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 2, // one app server + database: more parallel browsers only slow each other down
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] }, grep: /@phone/ },
  ],
});
