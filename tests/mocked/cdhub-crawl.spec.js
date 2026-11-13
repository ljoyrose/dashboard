// CD Hub click-crawl: every button, link and tap on the hub, the Temperatures page and the staff page, on the invented
// 27-animal set (tests/fixtures/cdhub-27). Desktop and a 360px phone. It must find no LOOP, DEAD, ERROR, ESCAPE or
// WORDING, and must have tapped at least 95% of the controls it could reach. It prints the number.
//
//   npx playwright test --project=mocked cdhub-crawl                 run it
//   CLICK_MAP=1 npx playwright test --project=mocked cdhub-crawl     also rewrite docs/cdhub/CLICK-MAP.md
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

    test('the hub: every control on every screen', async ({ page, guard }) => {
      test.setTimeout(900_000);
      await page.goto('cdhub/');
      await expect(page.locator('#signinbtn')).toBeEnabled();
      await page.locator('#signinbtn').click();
      const ready = async () => { await expect(page.locator('#nav button[data-go]').first()).toBeVisible({ timeout: 15000 }); };
      await ready();
      // Start screens come from the page itself: the bottom bar and the More list. Nothing is listed here by hand.
      const ids = await page.evaluate(() => Array.from(document.querySelectorAll('#nav [data-go]')).map((b) => b.dataset.go));
      const roots = [...new Set(ids)].filter((id) => !HIDDEN.includes(id));
      expect(roots.length, 'the bottom bar and More list offer screens').toBeGreaterThanOrEqual(5);
      const hiddenState = (st) => HIDDEN.includes((st.hash || '').replace(/^#\//, '').split('/')[0]);
      const r = await crawl({
        name: 'hub ' + view.name, page, guard, roots, maxDepth: 2, maxStates: 10,
        open: async (id) => { await page.goto('about:blank'); await page.goto('cdhub/#/' + id); await ready(); },
        redraw: async (id) => page.evaluate((i) => {
          if (typeof go !== 'function' || typeof LOAD === 'undefined' || LOAD.state !== 'ok') return false;
          // folds are remembered: each tap starts with none (the page listens for this event and forgets them)
          try { localStorage.removeItem('dash-fold'); window.dispatchEvent(new StorageEvent('storage', { key: 'dash-fold' })); } catch (e) { /* private mode */ }
          document.querySelectorAll('dialog[open]').forEach((d) => d.close());
          if (window.DashKit && DashKit.tabs && DashKit.tabs.shut) DashKit.tabs.shut();
          history.replaceState(null, '', '#/' + i); go(i, false); window.scrollTo(0, 0);
          return true;
        }, id),
        busy: () => page.evaluate(() => typeof LOAD !== 'undefined' && LOAD.state === 'loading'),
        inSite: ours,
        hidden: hiddenState,
        skip: (c) => (/signout=/.test(c.sig) ? 'signing out ends the walk (it has its own check below)' : ''),
        // Refresh reads the tables again and draws the same screen: with nothing new to read, nothing new shows.
        deadOk: (c) => (/reload=/.test(c.sig) ? 'reads the tables again' : ''),
        // The Look menu changes how the whole page looks and remembers it: the next tap starts from a fresh load.
        dirty: (c) => /^<(button|input)[^>]*(data-look|name="look|data-house-look)/.test(c.tag) || /look/i.test(c.sig.split('|')[3] || ''),
      });
      // Old addresses of the hidden screens: Main, or (until PR 472 lands) the old screen. Never an error, never a blank page.
      for (const id of HIDDEN) {
        await page.goto('about:blank'); await page.goto('cdhub/#/' + id); await ready();
        const h = (await page.locator('#main h2').first().textContent()).trim();
        const wired = await page.evaluate((i) => typeof PAGES !== 'undefined' && !!PAGES[i], id);
        if (!wired) expect(h, '#/' + id + ' is switched off, so it opens Main').toBe('Main');
        r.rows.push({ screen: '#/' + id + ' (old address)', control: '(typed address)', kind: '', target: wired ? 'still wired until PR 472 lands' : 'Main', result: wired ? 'switched off for now: not walked' : 'opens Main' });
      }
      // Sign out, last: back to the sign-in card, nothing left on screen.
      await page.goto('cdhub/#/map'); await ready();
      await page.locator('#cdSignout').click();
      await expect(page.locator('#signinbtn')).toBeVisible();
      await expect(page.locator('#nav')).toBeEmpty();
      r.rows.push({ screen: '#/map · Main', control: 'Sign out', kind: 'button', target: 'Sign in to see the tables', result: 'signs out' });
      save('hub-' + view.name, r); report(r); judge(r);
    });
  });
}
