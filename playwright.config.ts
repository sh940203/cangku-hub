import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against `next dev` on its own port with a throwaway SQLite file, never Turso.
const PORT = 3200;
const DB = "file:e2e.db";

export default defineConfig({
  testDir: "e2e",
  // One shared database, so tests run in order in a single worker.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `node scripts/e2e-reset-db.mjs && next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: { TURSO_DATABASE_URL: DB, TURSO_AUTH_TOKEN: "" },
    // Always start fresh: a reused server would point at whatever database it was started with.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
