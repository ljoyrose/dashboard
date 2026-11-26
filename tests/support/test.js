const base = require('@playwright/test');
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const fs = require('fs');
const path = require('path');
const gisStub = require('./gis-stub');
const { buildWorld } = require('./world');

const LOOKS_ONLY = [/^https:\/\/fonts\.googleapis\.com\//, /^https:\/\/fonts\.gstatic\.com\//, /^https:\/\/cdn\.jsdelivr\.net\/npm\/@tabler\/icons-webfont@[\d.]+\/dist\//];

const test = base.test.extend({
  world: [async ({}, use) => use(buildWorld()), { option: false }],
  gisMode: ['ok', { option: true }],
  moneyToday: ['2026-03-10', { option: true }],

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
      // Google sign-in stand-in
      await context.route('https://accounts.google.com/gsi/client', (route) =>
        route.fulfill({ status: 200, contentType: 'text/javascript', body: gisStub })
      );
      await world.install(context);
      await context.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\?q=name[^&]*DASH_CONFIG\.json/, (route) => {
        const auth = route.request().headers()['authorization'] || '';
        if (/^Bearer FAKE-(TEST|PERSONAL|PERSONAL-BIN)-TOKEN$/.test(auth)) return route.fallback();
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ files: [] }) });
      });
      await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost).*/, (route) => {
        const url = route.request().url();
        if (/^https:\/\/(accounts\.google\.com\/gsi\/client|www\.googleapis\.com\/drive\/v3\/)/.test(url)) return route.fallback();
        if (LOOKS_ONLY.some((re) => re.test(url))) {
          return route.fulfill({ status: 200, contentType: url.includes('fonts.googleapis') || /\.css(\?|$)/.test(url) ? 'text/css' : 'font/woff2', body: '' });
        }
        if (/^https:\/\/(www\.)?example\.(com|org|net)\/[^?#]*\.(png|jpe?g|svg|webp|gif)(\?|$)/i.test(url)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG1 });
        outside.push(url);
        return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
      });
      const ownedCalls = [];
      const OWNED = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'owned-tools.json'), 'utf8'));
      await context.route(/^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/[^/]+\/values\/OWNED_TOOLS/, (route) => {
        const req = route.request();
        ownedCalls.push({ url: req.url(), auth: !!(req.headers().authorization || '').match(/^Bearer \S+/) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ range: 'OWNED_TOOLS!A1:E', majorDimension: 'ROWS', values: OWNED.values }) });
      });

      const homePath = new RegExp('^' + require('./site').esc(require('./site').BASE) + '(index\\.html)?$');
      await context.route(/^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/[^/?]+\/values(:batchGet\?|\/Marketplace)/, (route) => {
        let from = '';
        try { from = new URL(route.request().frame().url()).pathname; } catch (e) { from = ''; }
        if (!homePath.test(from)) return route.fallback();
        const batch = /:batchGet\?/.test(route.request().url());
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(batch ? { valueRanges: [{}, {}, {}] } : { range: 'Marketplace!A2:L', majorDimension: 'ROWS' }) });
      });
      const PH_INDEX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'projects-hub-index.json'), 'utf8'));
      await context.route(/^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/[^/]+\/values\/INDEX\?/, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ range: 'INDEX!A1:AH60', majorDimension: 'ROWS', values: PH_INDEX.values }) })
      );

      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') consoleSeen.push(`[${m.type()}] ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push('Page error: ' + e.message));

      const guard = { outside, consoleSeen, problems, world, ownedCalls };
      await use(guard);

      if (world.unhandled && world.unhandled.length) {
        try {
          fs.mkdirSync('test-results', { recursive: true });
          fs.appendFileSync(path.join('test-results', 'unhandled-drive.jsonl'), world.unhandled.map((c) => JSON.stringify({ call: c })).join('\n') + '\n');
        } catch (e) { /* never let bookkeeping fail a test */ }
      }

      const unexpected = consoleSeen.filter((t) => !/Service Worker registration blocked by Playwright/.test(t) && !allowedConsole.some((re) => re.test(t)));
      base.expect(problems, 'Uncaught errors on the page').toEqual([]);
      base.expect(unexpected, 'Unexpected console errors or warnings').toEqual([]);
      base.expect(outside, 'The page tried to call an outside address that is not mocked').toEqual([]);
    },
    { auto: true },
  ],
});

module.exports = { test, expect: base.expect, buildWorld };

