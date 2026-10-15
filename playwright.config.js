// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.PORT || 4173);
const LOCAL = `http://127.0.0.1:${PORT}/dashboard/`;
const LIVE = 'https://ljoyrose.github.io/dashboard/';

module.exports = defineConfig({
  testDir: './tests',
  // Not a typo: the main suite is the "mocked" folder. The optional live check sits apart.
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  },
  projects: [
    {
      // Everything here uses the pretend Google sign-in and pretend Drive. No internet needed.
      name: 'mocked',
      testDir: './tests/mocked',
      use: { ...devices['Desktop Chrome'], baseURL: LOCAL },
    },
    {
      // Optional. Only opens the three real web addresses, signed out. Skipped unless LIVE_SMOKE=1.
      name: 'live-smoke',
      testDir: './tests/live',
      use: { ...devices['Desktop Chrome'], baseURL: LIVE },
    },
  ],
  webServer: {
    command: 'node tests/support/static-server.js',
    url: LOCAL,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
});
