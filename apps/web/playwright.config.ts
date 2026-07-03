import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const appDir = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const isCI = Boolean(process.env.CI);
const webServerTimeout = Number(process.env.E2E_WEB_SERVER_TIMEOUT ?? 420_000);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ...(isCI
      ? ([["junit", { outputFile: "test-results/e2e-junit.xml" }]] as const)
      : []),
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command:
          process.env.E2E_WEB_SERVER_COMMAND ??
          `pnpm build && pnpm exec next start --hostname 127.0.0.1 --port ${port}`,
        cwd: appDir,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: webServerTimeout,
        env: {
          ...process.env,
          API_ORIGIN: process.env.API_ORIGIN ?? "http://127.0.0.1:8080",
          NEXT_PUBLIC_APP_TZ: process.env.NEXT_PUBLIC_APP_TZ ?? "Africa/Accra",
          NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? baseURL,
        },
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 15"] },
    },
  ],
});
