import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/demo",
  use: {
    trace: "off",
    contextOptions: {
      ignoreHTTPSErrors: true,
    },
  },
  projects: [
    {
      name: "web",
      testMatch: "web.spec.ts",
      use: {
        baseURL: process.env.WEB_BASE_URL || "https://porra-mundial-six.vercel.app",
        locale: "en-US",
        viewport: { width: 1920, height: 1080 },
        video: { mode: "on", size: { width: 1920, height: 1080 } },
        launchOptions: { slowMo: 320 },
      },
    },
    {
      name: "agent",
      testMatch: "agent.spec.ts",
      timeout: 300_000,
      use: {
        baseURL: process.env.WEB_BASE_URL || "https://porra-mundial-six.vercel.app",
        locale: "en-US",
        viewport: { width: 1920, height: 1080 },
        video: { mode: "on", size: { width: 1920, height: 1080 } },
        launchOptions: { slowMo: 320 },
      },
    },
    {
      name: "evals",
      testMatch: "evals.spec.ts",
      timeout: 240_000,
      use: {
        baseURL: process.env.WEB_BASE_URL || "https://porra-mundial-six.vercel.app",
        locale: "en-US",
        viewport: { width: 1920, height: 1080 },
        video: { mode: "on", size: { width: 1920, height: 1080 } },
        launchOptions: { slowMo: 320 },
      },
    },
    {
      name: "langflow",
      testMatch: "langflow.spec.ts",
      timeout: 120_000,
      use: {
        baseURL: process.env.LANGFLOW_BASE_URL || "http://localhost:7861",
        locale: "en-US",
        viewport: { width: 1920, height: 1080 },
        video: { mode: "on", size: { width: 1920, height: 1080 } },
        launchOptions: { slowMo: 320 },
      },
    },
    {
      name: "mobile",
      testMatch: "mobile.spec.ts",
      timeout: 300_000,
      use: {
        baseURL: process.env.MOBILE_BASE_URL || "http://localhost:8081",
        ...devices["Pixel 7"],
        locale: "en-US",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        video: { mode: "on", size: { width: 390, height: 844 } },
        launchOptions: { slowMo: 320 },
      },
    },
  ],
});
