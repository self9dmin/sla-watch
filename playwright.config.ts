import { defineConfig, devices } from '@playwright/test';

const targetUrl = process.env.DT_APP_E2E_URL;

if (!targetUrl) {
  throw new Error('DT_APP_E2E_URL is required to run authenticated end-to-end tests.');
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  use: {
    baseURL: targetUrl,
    storageState: process.env.DT_APP_E2E_AUTH_STATE || undefined,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
