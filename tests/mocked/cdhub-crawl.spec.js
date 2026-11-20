// CD Hub click-crawl: every button, link and tap on the hub, the Temperatures page and the staff page, on the invented
// 27-animal set (tests/fixtures/cdhub-27). Desktop and a 360px phone. It must find no LOOP, DEAD, ERROR, ESCAPE or
// WORDING, and must have tapped at least 95% of the controls it could reach. It prints the number.
//
//   npx playwright test --project=mocked cdhub-crawl     run it (it writes test-results/cdhub-crawl/*.json)
//   node tools/cdhub-click-map/make.js                   turn those results into docs/cdhub/CLICK-MAP.md
//
// Nothing here signs in to Google or reads a real Drive. Saves go to a pretend save script.
const fs = require('fs');
const path = require('path');
const base = require('../support/test');
const { buildWorld } = require('../support/world');
const c27 = require('../support/cdhub27');
const { inPage, crawl, summary, findingLines } = require('../support/click-crawl');
const { BASE } = require('../support/site');

const test = base.test.extend({ world: async ({}, use) => use(c27.install(buildWorld())) });
const { expect } = base;

// Lisa hid these (PR 472 unwires them). Until that lands they still open; after it they open Main. Either is accepted,
// and they are never walked, so this test gives the same answer before and after.
const HIDDEN = ['buyers', 'shape', 'litters', 'vet'];
const SLOTS = 16;   // the most start screens the hub may offer (today it offers fewer; the spare slots skip)
const OUT = path.join(__dirname, '..', '..', 'test-results', 'cdhub-crawl');
const VIEWS = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  { name: 'phone', use: { viewport: { width: 360, height: 740 }, hasTouch: true } },
];
const ours = (url) => {
  let u; try { u = new URL(url); } catch (e) { return ''; }
  if (!/^(127\.0\.0\.1|localhost)$/.test(u.hostname) || !u.pathname.startsWith(BASE)) return '';
  const p = u.pathname.slice(BASE.length).replace(/index\.html$/, '');
  if (p === '') return 'Dashboard (home)';
  if (p === 'cdhub/') return 'CD Hub';
  if (p === 'cdhub/history.html') return 'Temperatures page';
  if (p === 'cdhub/history-archive.html') return 'Temperatures archive page';
  if (p === 'cdhub/staff/') return 'Staff page';
  if (p === 'cdhub/checks/') return 'Checks page';
  if (/^cdhub\/staff\/(print|inspect|guest)\/$/.test(p)) return 'Staff ' + p.split('/')[2] + ' page';
  if (/^breed-better\//.test(p)) return 'Breed Better page';
  if (/^(money|food|estate|studio|factory|marketplace|enquiries)\/$/.test(p)) return p.replace('/', '') + ' hub';
  return '';
};
const save = (name, r) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(r, null, 1)); };
const report = (r) => {
  console.log('CRAWL ' + summary(r));
  if (r.missed.length) console.log('  not reached: ' + r.missed.slice(0, 12).map((m) => m.screen + ' › ' + m.label).join(' ; '));
  findingLines(r).forEach((l) => console.log('  ' + l));
};
const judge = (r) => {
  expect(findingLines(r), 'Every tap must do something, stay on our pages and read in plain words').toEqual([]);
  expect(r.tapped / Math.max(1, r.reachable), `${r.tapped} of ${r.reachable} reachable controls were tapped`).toBeGreaterThanOrEqual(0.95);
};

for (const view of VIEWS) {
  test.describe('CD Hub click-crawl, ' + view.name, () => {
    test.use(view.use);
    test.beforeEach(async ({ page, context }) => {
      await context.addInitScript(inPage);
      await page.clock.setFixedTime(c27.NOW);
      // Folds are remembered between visits: start each crawl with nothing folded.
      await page.addInitScript(() => { try { localStorage.removeItem('dash-fold'); localStorage.removeItem('dash-look'); } catch (e) { /* private mode */ } });
      // The Temperatures page reads one published sheet as CSV: answered here with invented rows.
      await page.route(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export/, (route) =>
        route.fulfill({ status: 200, contentType: 'text/csv', body: 'on_date,reading_kind,max_temp,min_temp\n2026-03-09,observed,11.0,3.0\n2026-03-10,observed,12.0,4.0\n' }));
    });

    // The hub is walked one start screen at a time, so the walks can run side by side and one bad screen fails alone.
    // Start screens come from the page itself (the bottom bar and the More list): nothing is listed here by hand.
    // SLOTS is only how many there may be; slot n walks the n-th start screen, and a slot past the end is skipped.
    const signIn = async (page) => {
      await page.goto('cdhub/');
      await expect(page.locator('#signinbtn')).toBeEnabled();
      await page.locator('#signinbtn').click();
    };
    const ready = async (page) => { await expect(page.locator('#nav button[data-go]').first()).toBeVisible({ timeout: 20000 }); };
    // the first tables and the later ones are in: only then is the More list complete
    const loaded = (page) => page.waitForFunction(() => typeof LOAD !== 'undefined' && LOAD.state === 'ok' && LOAD.later !== 'wait' && !document.getElementById('cdWait'), null, { timeout: 20000 }).catch(() => {});
    const startScreens = async (page) => {
      const ids = await page.evaluate(() => Array.from(document.querySelectorAll('#nav [data-go]')).map((b) => b.dataset.go));
      return [...new Set(ids)].filter((id) => !HIDDEN.includes(id));
    };
    for (let slot = 1; slot <= SLOTS; slot++) {
      test(`the hub, start screen ${slot}: every control on it and one and two taps in`, async ({ page, guard }) => {
        test.setTimeout(900_000);
        await signIn(page); await ready(page); await loaded(page);
        const all = await startScreens(page);
        expect(all.length, 'the bottom bar and More list offer screens').toBeGreaterThanOrEqual(5);
        expect(all.length, 'more start screens than this walk has slots for: raise SLOTS in this file').toBeLessThanOrEqual(SLOTS);
        test.skip(slot > all.length, 'the hub has ' + all.length + ' start screens today');
        const root = all[slot - 1];
        const hiddenState = (st) => HIDDEN.includes((st.hash || '').replace(/^#\//, '').split('/')[0]);
        const r = await crawl({
          name: 'hub ' + view.name + ' ' + root, page, guard, roots: [root], maxDepth: 2, maxStates: 8, noChrome: slot !== 1,
          open: async (id) => { await page.goto('about:blank'); await page.goto('cdhub/#/' + id); await ready(page); },
          redraw: async (id) => page.evaluate((i) => {
            if (typeof go !== 'function' || typeof LOAD === 'undefined' || LOAD.state !== 'ok') return false;
            // folds are remembered: each tap starts with none (the page listens for this event and forgets them)
            try { localStorage.removeItem('dash-fold'); window.dispatchEvent(new StorageEvent('storage', { key: 'dash-fold' })); } catch (e) { /* private mode */ }
            document.querySelectorAll('dialog[open]').forEach((d) => d.close());
            if (window.DashKit && DashKit.tabs && DashKit.tabs.shut) DashKit.tabs.shut();
            history.replaceState(null, '', '#/' + i); go(i, false); window.scrollTo(0, 0);
            return true;
          }, id),
          // still reading: the first tables, or the later ones a screen waits for ("Getting these records ready")
          busy: () => page.evaluate(() => typeof LOAD !== 'undefined' && (LOAD.state === 'loading' || (LOAD.state === 'ok' && LOAD.later === 'wait') || !!document.getElementById('cdWait'))),
          inSite: ours,
          hidden: hiddenState,
          // a screen one tap in that has its own address (#/dogs/mar, #/today/adults) is opened by that address
          addr: (st) => (/^#\/[\w./%-]+$/.test(st.hash || '') ? st.hash.slice(2) : ''),
          // another start screen: it has its own walk
          elsewhere: (st) => all.some((id) => id !== root && st.hash === '#/' + id),
          skip: (c) => (/sign\s?out/i.test(c.label + ' ' + c.sig) ? 'signing out ends the walk (it has its own check)' : ''),
          // Refresh reads the tables again and draws the same screen: with nothing new to read, nothing new shows.
          // A button for the list that is already showing has nothing more to show.
          deadOk: (c, aft) => { const m = /(?:^|&)(?:list|golist)=([\w-]+)/.exec(c.sig.split('|')[3] || ''); return /reload=/.test(c.sig) ? 'reads the tables again' : m && aft.st.hash.endsWith('/' + m[1]) ? 'already showing this list' : ''; },
          // The Look menu changes how the whole page looks and remembers it: the next tap starts from a fresh load.
          dirty: (c) => /^<(button|input)[^>]*(data-look|name="look|data-house-look)/.test(c.tag) || /look/i.test(c.sig.split('|')[3] || ''),
        });
        save('hub-' + view.name + '-' + slot, r); report(r); judge(r);
      });
    }

    test('the hub: a switched-off screen\'s old address opens Main, and Sign out signs out', async ({ page }) => {
      test.setTimeout(120_000);
      await signIn(page); await ready(page); await loaded(page);
      const rows = [];
      // Old addresses of the hidden screens: Main, or (while one is still wired) the old screen. Never an error, never a blank page.
      for (const id of HIDDEN) {
        await page.goto('about:blank'); await page.goto('cdhub/#/' + id); await ready(page);
        const h = (await page.locator('#main h2').first().textContent()).trim();
        const wired = await page.evaluate((i) => typeof PAGES !== 'undefined' && !!PAGES[i] && (typeof viewOn !== 'function' || viewOn(i)), id);
        if (!wired) expect(h, '#/' + id + ' is switched off, so it opens Main').toBe('Main');
        rows.push({ screen: '#/' + id + ' (old address)', control: '(typed address)', kind: '', target: wired ? 'still wired' : 'Main', result: wired ? 'switched off for now: not walked' : 'opens Main' });
      }
      // Sign out: back to the sign-in card, nothing left on screen.
      await page.goto('cdhub/#/map'); await ready(page);
      if (await page.locator('#cdSignout').isVisible()) await page.locator('#cdSignout').click();
      else { await page.locator('[data-house-look] button').first().click(); await page.getByRole('button', { name: 'Sign out' }).click(); }   // a phone keeps Sign out inside the Look menu
      await expect(page.locator('#signinbtn')).toBeVisible();
      await expect(page.locator('#nav')).toBeEmpty();
      rows.push({ screen: '#/map · Main', control: 'Sign out', kind: 'button', target: 'Sign in to see the tables', result: 'signs out' });
      save('hub-' + view.name + '-0', { name: 'hub ' + view.name + ' addresses and sign out', rows, findings: [], reachable: 0, tapped: 0, states: 0, screens: [] });
    });

    test('the Temperatures page: every control', async ({ page, guard }) => {
      test.setTimeout(300_000);
      await page.goto('cdhub/');
      await expect(page.locator('#signinbtn')).toBeEnabled();
      await page.locator('#signinbtn').click();
      await expect(page.locator('#nav button[data-go]').first()).toBeVisible({ timeout: 15000 });
      const ready = async () => { await expect(page.locator('#boot')).toHaveCount(0, { timeout: 15000 }); await expect(page.locator('#main :is(h2, h3)').first()).toBeVisible({ timeout: 15000 }); };
      const open = async (file) => { await page.goto('about:blank'); await page.goto('cdhub/' + file); await ready(); };
      await open('history.html');
      const r = await crawl({
        name: 'temperatures ' + view.name, page, guard, roots: ['history.html'], maxDepth: 2, maxStates: 12, open, inSite: ours,
        // A year calendar is hundreds of day buttons of a few kinds (inside the limit, outside, missed...): each kind is sampled.
        sample: (c) => { const m = /^<(?:button|div)[^>]*class="((?:d|sd) [^"]*)"/.exec(c.tag); return m ? m[1].replace(/\s*\btoday\b/, '') : ''; },
        skip: (c) => (/sign\s?out/i.test(c.label + ' ' + c.sig) ? 'signing out ends the walk (checked on the hub)' : ''),
      });
      save('temperatures-' + view.name, r); report(r); judge(r);
    });

    test('the staff page: every control, with the save script pretend', async ({ page, guard, allowedConsole }) => {
      test.setTimeout(600_000);
      allowedConsole.push(/404/);   // the page asks for optional helper files that are not all published
      const script = await c27.staffScript(page);
      const ready = async () => { await expect(page.locator('#screen')).not.toBeEmpty({ timeout: 15000 }); await expect(page.locator('#screen')).not.toHaveText(/^(Loading|Checking)\.\.\.$/, { timeout: 15000 }); };
      const open = async (route) => { await page.goto('about:blank'); await page.goto('cdhub/staff/#' + route); await ready(); };
      await open('home');
      const r = await crawl({
        name: 'staff ' + view.name, page, guard, roots: ['home', 'm/temperature', 'm/moves', 'm/where', 'm/jobs', 'm/report', 'scan', 'device'], maxDepth: 2, maxStates: 12, open, inSite: ours,
        allowConsole: [/404/],
        busy: () => page.evaluate(() => /^(Loading|Checking)\.\.\.$/.test((document.getElementById('screen') || {}).textContent || '')),
        // Removing the code un-sets the phone, and Print opens the printer box: each has its own test.
        skip: (c) => (/Remove my code/.test(c.label) ? 'it un-sets the phone (it has its own test)' : /^Print/.test(c.label) ? 'it opens the printer box' : ''),
        typeText: '18.5',
      });
      r.saves = script.sent.length;
      save('staff-' + view.name, r); report(r); judge(r);
    });
  });
}
