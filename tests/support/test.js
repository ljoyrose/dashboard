// Shared test setup.
//  - Replaces Google sign-in with a stand-in (never opens a real Google window).
//  - Gives every page a pretend Drive (never reads real Drive).
//  - Blocks every other outside address and remembers it, so a test fails if the page tries to call out.
//  - Watches the browser console and fails the test on unexpected errors.
const base = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const gisStub = require('./gis-stub');
const { buildWorld } = require('./world');

// Outside addresses the pages use for looks only. Answered with empty files so they never hit the internet.
const LOOKS_ONLY = [/^https:\/\/fonts\.googleapis\.com\//, /^https:\/\/fonts\.gstatic\.com\//];

const test = base.test.extend({
  // Which person the pretend Google account is, and what the pretend Drive holds. Tests may override.
  world: [async ({}, use) => use(buildWorld()), { option: false }],
  gisMode: ['ok', { option: true }],
  moneyToday: ['2026-03-10', { option: true }], // pins "today" in the Money code so fixture dates stay valid

  // Console messages that are allowed in a particular test (regex list). Push to it inside the test.
  allowedConsole: async ({}, use) => use([]),

  guard: [
    async ({ page, context, world, gisMode, moneyToday, allowedConsole }, use) => {
      const problems = [];
      const outside = [];
      const consoleSeen = [];

      await context.addInitScript(
        ({ mode, today }) => { window.__GIS_MODE = mode; window.__MONEY_TODAY = today; },
        { mode: gisMode, today: moneyToday }
      );
      // Remembers "this tab already signed in" for a quiet resume on the next page.
      // Lives in the test harness, not in a cookie or in page storage.
      let gisGranted = false;
      await context.exposeBinding('__gisGranted', () => gisGranted);
      await context.exposeBinding('__gisRemember', () => { gisGranted = true; });
      await context.exposeBinding('__gisForget', () => { gisGranted = false; });
      // Google sign-in stand-in
      await context.route('https://accounts.google.com/gsi/client', (route) =>
        route.fulfill({ status: 200, contentType: 'text/javascript', body: gisStub })
      );
      await world.install(context);
      // Anything else that leaves the machine: record it, answer it empty.
      await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost).*/, (route) => {
        const url = route.request().url();
        if (/^https:\/\/(accounts\.google\.com\/gsi\/client|www\.googleapis\.com\/drive\/v3\/)/.test(url)) return route.fallback();
        if (LOOKS_ONLY.some((re) => re.test(url))) {
          return route.fulfill({ status: 200, contentType: url.includes('fonts.googleapis') ? 'text/css' : 'font/woff2', body: '' });
        }
        outside.push(url);
        return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
      });

      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') consoleSeen.push(`[${m.type()}] ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push('Page error: ' + e.message));

      const guard = { outside, consoleSeen, problems, world };
      await use(guard);

      // Drift check: remember Drive calls the pretend Drive could not answer (counted in the Action summary).
      if (world.unhandled && world.unhandled.length) {
        try {
          fs.mkdirSync('test-results', { recursive: true });
          fs.appendFileSync(path.join('test-results', 'unhandled-drive.jsonl'), world.unhandled.map((c) => JSON.stringify({ call: c })).join('\n') + '\n');
        } catch (e) { /* never let bookkeeping fail a test */ }
      }

      const unexpected = consoleSeen.filter((t) => !allowedConsole.some((re) => re.test(t)));
      base.expect(problems, 'Uncaught errors on the page').toEqual([]);
      base.expect(unexpected, 'Unexpected console errors or warnings').toEqual([]);
      base.expect(outside, 'The page tried to call an outside address that is not mocked').toEqual([]);
    },
    { auto: true },
  ],
});

module.exports = { test, expect: base.expect, buildWorld };
