// "No DASH_CONFIG.json on Drive = the same as today."
// Every page that loads config.js is booted twice on the same pretend Drive, signed out and signed in:
//   as on main   = config.js with the private settings loader cut off and auth.js without its sign-in signal
//   as shipped   = this branch, with no DASH_CONFIG.json on Drive
// The headings (and whether each one shows), the Drive calls, the outside calls and the console must match exactly.
// The only extra thing allowed is the loader's one look for the file after sign-in.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');

const ROOT = path.join(__dirname, '..', '..');
const SKIP = ['node_modules', 'tests', 'docs', 'tools', 'cdhub-write', '_site', 'test-results', 'playwright-report'];
const MARK = '\n// ---- Private settings loader';
const NAME = 'DASH_CONFIG.json';
const TOKEN = { access_token: 'FAKE-TEST-TOKEN', scope: 'https://www.googleapis.com/auth/drive.readonly' };

// Found by reading the repo, so a new page that loads config.js is covered without touching this file.
const PAGES = (function walk(dir, out) {
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach((e) => {
    const rel = dir ? dir + '/' + e.name : e.name;
    if (e.name.startsWith('.') || SKIP.includes(rel)) return;
    if (e.isDirectory()) walk(rel, out);
    else if (/\.html$/.test(e.name) && /<script src="(\.\.\/)*config\.js"><\/script>/.test(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) out.push(rel);
  });
  return out;
})('', []).sort();

const asOnMain = async (page) => {
  await page.route('**/config.js', async (route) => {
    const text = await (await route.fetch()).text();
    if (!text.includes(MARK)) throw new Error('config.js no longer has the loader marker');
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: text.slice(0, text.indexOf(MARK)) + '\n' });
  });
  await page.route('**/auth.js', async (route) => {
    const text = await (await route.fetch()).text();
    if (text.split('    notify();\n').length !== 3) throw new Error('auth.js no longer calls notify() exactly twice');
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: text.split('    notify();\n').join('') });
  });
};

const boot = async (page, guard, url, signedIn) => {
  guard.world.calls.length = 0; guard.outside.length = 0; guard.consoleSeen.length = 0; guard.problems.length = 0;
  if (signedIn) {
    await page.evaluate((t) => localStorage.setItem('ljr-dash-auth', JSON.stringify(Object.assign({ expires_at: Date.now() + 1800000 }, t))), TOKEN);
    await page.reload();
  } else {
    await page.goto(url);
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(250);
  const heads = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].map((h) => {
    const cs = getComputedStyle(h), r = h.getBoundingClientRect();
    return h.tagName + (cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 1 && r.height > 1 ? ' shown: ' : ' hidden: ') + h.textContent.replace(/\s+/g, ' ').trim();
  }));
  const stamp = (s) => s.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<time>');
  const drive = guard.world.calls.map((c) => stamp(c.method + ' ' + c.path + ' ' + c.query));
  return {
    heads,
    looks: drive.filter((c) => c.includes(NAME)).length,
    drive: drive.filter((c) => !c.includes(NAME)).sort(),
    outside: guard.outside.map(stamp).sort(),
    console: guard.consoleSeen.map(stamp).sort(),
    errors: guard.problems.slice().sort(),
  };
};
const both = async (page, guard, url) => {
  const out = await boot(page, guard, url, false);
  const inn = await boot(page, guard, url, true);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  return { out, inn };
};

test('the list of pages that load config.js was found', () => {
  expect(PAGES).toContain('index.html');
  expect(PAGES.length).toBeGreaterThanOrEqual(10);
});

for (const rel of PAGES) {
  test('same as today with no private settings file: ' + rel, async ({ page, guard }) => {
    test.setTimeout(90000);
    const url = './' + rel.replace(/(^|\/)index\.html$/, '$1');
    await asOnMain(page);
    const main = await both(page, guard, url);
    await page.unroute('**/config.js');
    await page.unroute('**/auth.js');
    const shipped = await both(page, guard, url);
    // This test compares two boots of one page. What a page may call or log is owned by that page's own specs,
    // so the shared end-of-test checks are cleared here once the comparison has been made.
    guard.outside.length = 0; guard.consoleSeen.length = 0; guard.problems.length = 0;

    expect(main.out.looks + main.inn.looks, 'main never looks for the file').toBe(0);
    expect(shipped.out.looks, 'signed out: no look').toBe(0);
    expect(shipped.inn.looks, 'signed in: at most one look').toBeLessThanOrEqual(1);
    expect(main.inn.heads.length, 'the page has headings to compare').toBeGreaterThan(0);
    for (const k of ['out', 'inn']) {
      expect(shipped[k].heads, k + ': headings').toEqual(main[k].heads);
      expect(shipped[k].drive, k + ': Drive calls').toEqual(main[k].drive);
      expect(shipped[k].outside, k + ': outside calls').toEqual(main[k].outside);
      expect(shipped[k].console, k + ': console').toEqual(main[k].console);
      expect(shipped[k].errors, k + ': page errors').toEqual(main[k].errors);
    }
  });
}
