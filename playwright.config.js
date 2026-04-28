const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "\"C:\\Program Files\\nodejs\\npm.cmd\" run dev",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 60_000
  }
});
