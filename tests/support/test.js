// Shared test setup.
//  - Replaces Google sign-in with a stand-in (never opens a real Google window).
//  - Gives every page a pretend Drive (never reads real Drive).
//  - Blocks every other outside address and remembers it, so a test fails if the page tries to call out.
//  - Watches the browser console and fails the test on unexpected errors.
const base = require('@playwright/test');
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const fs = require('fs');
const path = require('path');
const gisStub = require('./gis-stub');
const { buildWorld } = require('./world');

// Outside addresses the pages use for looks only. Answered with empty files so they never hit the internet.
// Looks only (fonts and the Factory page's icon font): answered empty, never a data call.
// LIVE_FEATURES=1 (the live-features project): the live site's own files load from the network, so the DEPLOYED pages run.
// Everything else (Google sign-in, Drive, the save script, any other address) stays pretend exactly as below.
const LIVE_PREFIX = process.env.LIVE_FEATURES ? require('./site').LIVE.replace(/\/?$/, '/') : '';

const LOOKS_ONLY = [/^https:\/\/fonts\.googleapis\.com\//, /^https:\/\/fonts\.gstatic\.com\//, /^https:\/\/cdn\.jsdelivr\.net\/npm\/@tabler\/icons-webfont@[\d.]+\/dist\//];

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
      const liveLoads = []; // LIVE_FEATURES only: the live site's files this test loaded
      const live = LIVE_PREFIX && base.test.info().project.name === 'live-features' ? LIVE_PREFIX : '';

      await context.addInitScript(
        ({ mode, today }) => { window.__GIS_MODE = mode; window.__MONEY_TODAY = today; },
        { mode: gisMode, today: moneyToday }
      );
      // Google sign-in stand-in
      await context.route('https://accounts.google.com/gsi/client', (route) =>
        route.fulfill({ status: 200, contentType: 'text/javascript', body: gisStub })
      );
      await world.install(context);
      // Private settings look-up (config.js loader) made with a pretend sign-in the pretend Drive does not know (some specs
      // save their own invented token): answered "no such file", as real Drive would for a signed-in account without one.
      // The pretend Drive's own tokens fall through to it, so private-config.spec.js still sees every look.
      await context.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\?q=name[^&]*DASH_CONFIG\.json/, (route) => {
        const auth = route.request().headers()['authorization'] || '';
        if (/^Bearer FAKE-(TEST|PERSONAL|PERSONAL-BIN)-TOKEN$/.test(auth)) return route.fallback();
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ files: [] }) });
      });
      // Anything else that leaves the machine: record it, answer it empty.
      await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost).*/, (route) => {
        const url = route.request().url();
        if (live && url.startsWith(live)) { liveLoads.push(url); return route.fallback(); }
        if (/^https:\/\/(accounts\.google\.com\/gsi\/client|www\.googleapis\.com\/drive\/v3\/)/.test(url)) return route.fallback();
        if (LOOKS_ONLY.some((re) => re.test(url))) {
          return route.fulfill({ status: 200, contentType: url.includes('fonts.googleapis') || /\.css(\?|$)/.test(url) ? 'text/css' : 'font/woff2', body: '' });
        }
        // Reserved example domains (RFC 2606) never resolve in real life: fixture images there (brand logos) get a 1px PNG.
        if (/^https:\/\/(www\.)?example\.(com|org|net)\/[^?#]*\.(png|jpe?g|svg|webp|gif)(\?|$)/i.test(url)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG1 });
        outside.push(url);
        return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
      });
      // Studio's Owned tools list (Sheets values read): answered from an invented sample (added after the catch-all, so it wins), and every call remembered with
      // whether it carried a sign-in token, so tests can prove it is only read after sign-in.
      const ownedCalls = [];
      const OWNED = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'owned-tools.json'), 'utf8'));
      await context.route(/^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/[^/]+\/values\/OWNED_TOOLS/, (route) => {
        const req = route.request();
        ownedCalls.push({ url: req.url(), auth: !!(req.headers().authorization || '').match(/^Bearer \S+/) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ range: 'OWNED_TOOLS!A1:E', majorDimension: 'ROWS', values: OWNED.values }) });
      });

      // Dashboard Main hub tiles (HubRead in index.html) read the GA book (Food) and the Marketplace tab, GET only. On the Dashboard page alone
      // they get empty sheets (so the tiles show 0, no rows); a spec that wants numbers answers with page.route, which wins.
      // Any other page calling Sheets still falls through to the catch-all above and fails the test.
      const homePath = new RegExp('^' + require('./site').esc(require('./site').BASE) + '(index\\.html)?$');
      await context.route(/^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/[^/?]+\/values(:batchGet\?|\/Marketplace)/, (route) => {
        let from = '';
        try { from = new URL(route.request().frame().url()).pathname; } catch (e) { from = ''; }
        if (!homePath.test(from)) return route.fallback();
        const batch = /:batchGet\?/.test(route.request().url());
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(batch ? { valueRanges: [{}, {}, {}] } : { range: 'Marketplace!A2:L', majorDimension: 'ROWS' }) });
      });
      // Projects tile numbers (Projects Hub Sheet, INDEX tab): answered from invented rows, after the catch-all so it wins.
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

      // Drift check: remember Drive calls the pretend Drive could not answer (counted in the Action summary).
      if (world.unhandled && world.unhandled.length) {
        try {
          fs.mkdirSync('test-results', { recursive: true });
          fs.appendFileSync(path.join('test-results', 'unhandled-drive.jsonl'), world.unhandled.map((c) => JSON.stringify({ call: c })).join('\n') + '\n');
        } catch (e) { /* never let bookkeeping fail a test */ }
      }

      // The suite blocks service workers on purpose (playwright.config.js), and Chrome says so. Not a page problem.
      const unexpected = consoleSeen.filter((t) => !/Service Worker registration blocked by Playwright/.test(t) && !allowedConsole.some((re) => re.test(t)));
      base.expect(problems, 'Uncaught errors on the page').toEqual([]);
      base.expect(unexpected, 'Unexpected console errors or warnings').toEqual([]);
      // A live feature check that loaded nothing from the live site checked nothing live.
      if (live) base.expect(liveLoads.length, 'LIVE_FEATURES: no file came from the live site ' + live).toBeGreaterThan(0);
      base.expect(outside, 'The page tried to call an outside address that is not mocked').toEqual([]);
    },
    { auto: true },
  ],
});

module.exports = { test, expect: base.expect, buildWorld };
