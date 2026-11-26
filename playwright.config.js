// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.PORT || 4173);
const { BASE } = require('./tests/support/site');
const LOCAL = `http://127.0.0.1:${PORT}${BASE}`;
const LIVE = process.env.LIVE_URL || 'https://ljoyrose.github.io/dashboard/';

module.exports = defineConfig({
  testDir: './tests',
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
      name: 'mocked',
      testDir: './tests/mocked',
      use: { ...devices['Desktop Chrome'], baseURL: LOCAL, serviceWorkers: 'block' },
    },
    {
      name: 'phone',
      testDir: './tests/phone',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, baseURL: LOCAL, serviceWorkers: 'block' },
    },
    {
      name: 'live-smoke',
      testDir: './tests/live',
      use: { ...devices['Desktop Chrome'], baseURL: LIVE },
    },
  ],
  webServer: {
    command: 'node tests/support/static-server.js',
    url: LOCAL,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT), SITE_BASE: BASE },
  },
});

