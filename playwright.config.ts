import { defineConfig } from "@playwright/test";
import { E2E_ENV, E2E_URL } from "./tests/e2e/env";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: E2E_URL,
    // CI installs Playwright's Chromium; locally set PW_CHANNEL=chrome to use an installed Chrome.
    channel: process.env.PW_CHANNEL || undefined,
  },
  webServer: {
    command: "npm run build && npm run start -- --port 4174",
    url: E2E_URL,
    // Never reuse a server: it must be this build, running with the placeholder secrets below.
    reuseExistingServer: false,
    timeout: 180_000,
    env: E2E_ENV,
  },
});
