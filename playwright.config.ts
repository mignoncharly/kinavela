import { defineConfig, devices } from "@playwright/test";

const releaseCandidateServer = process.env.RELEASE_CANDIDATE_SERVER === "1";
const localBaseUrl = releaseCandidateServer
  ? "http://127.0.0.1:3021"
  : "http://127.0.0.1:3020";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? localBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"], browserName: "chromium" },
    },
    {
      name: "ios-safari",
      use: { ...devices["iPhone 14"], browserName: "webkit" },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], browserName: "chromium" },
    },
  ],
  webServer: releaseCandidateServer
    ? {
        command:
          "env KINAVELA_RELEASE_CANDIDATE_ORIGIN=http://127.0.0.1:3021 npm run start -- --hostname 127.0.0.1 --port 3021",
        url: `${localBaseUrl}/api/health`,
        reuseExistingServer: false,
      }
    : process.env.PLAYWRIGHT_BASE_URL
      ? undefined
      : {
          command: "npm run dev",
          url: `${localBaseUrl}/api/health`,
          reuseExistingServer: !process.env.CI,
        },
});
