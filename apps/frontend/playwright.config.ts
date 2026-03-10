import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.PORT ?? 3000;
const apiPort = process.env.API_PORT ?? 3001;
const baseURL = `http://localhost:${webPort}`;
const apiURL = `http://localhost:${apiPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: process.cwd().includes("apps/frontend") ? "../.." : ".",
    env: {
      ...process.env,
      PORT: String(webPort),
      NEXT_PUBLIC_API_URL: apiURL,
      E2E_TEST: "1",
    },
  },
});
