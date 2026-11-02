// JOB 34 (group C): Factory gaps only. Views reached by address that no other spec opens, the header buttons,
// the New idea and Problem forms end to end, the Health switch, Today / Week, the Apps table, hub-specific
// state-file messages, a failed write, links and keyboard reach. Invented data only (tests/fixtures/factory/state.js).
const { test, expect, HUBS, go } = require('../fixtures/job34/load');

const UPLOAD = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files/;
// Pretend Drive upload: records each request file the page writes ({meta, body}).
async function uploads(page, { status = 200 } = {}) {
  const got = [];
  await page.route(UPLOAD, (route) => {
    const parts = route.request().postData().split(/\r\n--af\d+(?:--)?/).map((p) => p.slice(p.indexOf('\r\n\r\n') + 4)).filter((p) => p.trim().startsWith('{'));
    got.push({ meta: JSON.parse(parts[0]), body: JSON.parse(parts[1]) });
    if (status !== 200) return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: status, message: 'Sample failure' } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'req-SAMPLE-' + got.length }) });
  });
  return got;
}
const view = (page) => page.locator('#view');
const stateReads = (guard) => guard.world.calls.filter((c) => /alt=media/.test(c.url)).length;

test.describe('JOB 34 Factory: views reached only by address', () => {
  test('card, queue, stuck and problem views draw; unknown ids say Not found with a way back to Rooms', async ({ page, guard }) => {
    await HUBS.factory.open(page, guard);
    await go(page, 'card/869fjxpc2');
    await expect(view(page)).toContainText('Sample Links');
    await expect(view(page).locator('a[aria-label="Open in ClickUp"]').first()).toHaveAttribute('href', 'https://app.clickup.com/t/869fjxpc2');
    await expect(page.locator('nav a[data-nav="rooms"]')).toHaveAttribute('aria-current', 'page');
    await go(page, 'queue/Claude');
    await expect(view(page).locator('.card, .row, .grp').first()).toBeVisible();
    await go(page, 'stuck');
    await expect(view(page)).toContainText('Stuck 14+ days');
    await expect(view(page)).toContainText('None right now. All clear.');
    await go(page, 'problem/869fjxpc2');
    await expect(view(page)).toContainText('Sample Links · problem');
    for (const bad of ['card/nope-SAMPLE', 'room/nope', 'problem/nope-SAMPLE']) {
      await go(page, bad);
      await expect(view(page), bad).toContainText('Not found.');
      await view(page).locator('a[href="#/rooms"]').first().click();
      await expect(page).toHaveURL(/#\/rooms$/);
    }
    await go(page, 'zz-unknown');
    await expect(view(page).locator('section.room').first()).toBeVisible(); // an unknown address falls back to Rooms
  });

  test('every in-page link on every view opens a real view (never Not found); every new-tab link is https with noopener', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource: .*404/); // an app card whose Drive card file is missing: the page shows the card without it
    await HUBS.factory.open(page, guard);
    const seen = new Set();
    for (const v of HUBS.factory.views) {
      await go(page, v);
      const links = await page.locator('header a[href], nav a[href], #view a[href]').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') || '' })));
      for (const l of links) {
        if (l.target === '_blank') { expect(l.href, l.href).toMatch(/^https:\/\//); expect(l.rel, l.href).toContain('noopener'); }
        else if (l.href.startsWith('#/')) seen.add(l.href);
      }
    }
    expect(seen.size).toBeGreaterThan(10);
    for (const h of seen) {
      await go(page, h.slice(2));
      await expect(view(page), h).not.toContainText('Not found.');
      await expect(view(page).locator('.banner'), h).toHaveCount(0);
    }
  });
});

test.describe('JOB 34 Factory: header buttons', () => {
  test('Read again reads af-state.json again; Sign out leaves only Sign in and clears the view', async ({ page, guard }) => {
    await HUBS.factory.open(page, guard);
    const before = stateReads(guard);
    await page.locator('#refreshBtn').click();
    await expect.poll(() => stateReads(guard)).toBeGreaterThan(before);
    await page.locator('#signOutBtn').click();
    await expect(view(page).locator('[data-action="signin"]')).toBeVisible();
    for (const id of ['#refreshBtn', '#signOutBtn', '#appPick']) await expect(page.locator(id)).toBeHidden();
    await expect(page.locator('#signInBtn')).toBeVisible();
    await expect(view(page)).not.toContainText('Sample Links');
  });
});

test.describe('JOB 34 Factory: forms', () => {
  test('New idea: Send with nothing names each missing answer and writes nothing; answered, it writes one idea file and returns to Rooms', async ({ page, guard }) => {
    const got = await uploads(page);
    await HUBS.factory.open(page, guard);
    await go(page, 'new');
    await view(page).locator('[data-action="sendidea"]').click();
    await expect(view(page).locator('.ferr').first()).toBeVisible();
    await expect(view(page)).toContainText('Add a name');
    expect(got).toHaveLength(0);
    // Answer every question that says it is missing: type in its box, or pick its first chip.
    await view(page).locator('[data-f="name"]').fill('APP-A');
    await view(page).locator('[data-action="sendidea"]').click();
    await expect(view(page)).not.toContainText('Add a name');
    for (let i = 0; i < 40; i++) {
      const q = view(page).locator('.fq:has(.ferr)').first();
      if (!(await q.count())) break;
      const box = q.locator('textarea, input');
      if (await box.count()) await box.first().fill('Sample words for a sample idea');
      else await q.locator('button').first().click();
      await view(page).locator('[data-action="sendidea"]').click();
    }
    await expect(page).toHaveURL(/#\/rooms$/);
    expect(got).toHaveLength(1);
    expect(got[0].meta.name).toMatch(/^idea-\d+\.json$/);
    expect(got[0].body).toMatchObject({ kind: 'idea', name: 'APP-A' });
    expect(got[0].body.by).toMatch(/@/); // who clicked: the signed-in email and device
    await expect(page.locator('#banner')).toContainText(/✓ \d\d:\d\d · card by/);
  });

  test('Problem: Send needs a kind and words; then one problem file and back to the app card', async ({ page, guard }) => {
    const got = await uploads(page);
    await HUBS.factory.open(page, guard);
    await go(page, 'problem/869fjxpc2');
    await view(page).locator('[data-action="sendprob"]').click();
    await expect(view(page)).toContainText('Pick one');
    await expect(view(page)).toContainText('Say what happened');
    expect(got).toHaveLength(0);
    await view(page).locator('[data-prob="down"]').click();
    await expect(view(page).locator('[data-prob="down"]')).toHaveClass(/\bon\b/);
    await view(page).locator('[data-f="pwhat"]').fill('Sample: the page does not open');
    await view(page).locator('[data-action="sendprob"]').click();
    await expect(page).toHaveURL(/#\/card\/869fjxpc2$/);
    expect(got).toHaveLength(1);
    expect(got[0].body).toMatchObject({ kind: 'problem', taskId: '869fjxpc2', problem: 'down', what: 'Sample: the page does not open' });
    await expect(page.locator('#banner')).toContainText('incident by');
  });

  test('Problem: Leak shows the Off first step', async ({ page, guard }) => {
    await HUBS.factory.open(page, guard);
    await go(page, 'problem/869fjxpc2');
    await expect(view(page)).not.toContainText('Off first');
    await view(page).locator('[data-prob="leak"]').click();
    await expect(view(page)).toContainText('Off first');
  });
});

test.describe('JOB 34 Factory: Health, Today and Apps', () => {
  test('Health: the Factory switch flips at once and writes one factory request (on: false)', async ({ page, guard }) => {
    const got = await uploads(page);
    await HUBS.factory.open(page, guard);
    await go(page, 'health');
    await expect(view(page)).toContainText('Screen sync');
    const sw = view(page).locator('[data-action="factory"] .sw');
    await expect(sw).toHaveClass(/\bon\b/);
    await view(page).locator('[data-action="factory"]').click();
    await expect(sw).not.toHaveClass(/\bon\b/);
    await expect.poll(() => got.length).toBe(1);
    expect(got[0].body).toMatchObject({ kind: 'factory', on: false });
    expect(got[0].meta.name).toMatch(/^factory-\d+\.json$/);
  });

  test('a write Drive refuses: "Not sent" banner and the switch goes back', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource: .*500/); // the browser's own line for the refused upload; the page says Not sent
    const got = await uploads(page, { status: 500 });
    await HUBS.factory.open(page, guard);
    await go(page, 'health');
    await view(page).locator('[data-action="factory"]').click();
    await expect(page.locator('#banner')).toContainText('Not sent: Drive said 500');
    await expect(view(page).locator('[data-action="factory"] .sw')).toHaveClass(/\bon\b/);
    expect(got).toHaveLength(1);
  });

  test('Today shows what is due today and overdue; Week adds what is due this week', async ({ page, guard }) => {
    await HUBS.factory.open(page, guard);
    await go(page, 'today');
    const today = view(page).locator('[data-action="today"]'), week = view(page).locator('[data-action="week"]');
    await expect(today).toHaveClass(/\bon\b/);
    await expect(view(page)).toContainText('Test the import on 3 files');
    await expect(view(page)).not.toContainText('Fix the pedigree PDF');
    await week.click();
    await expect(week).toHaveClass(/\bon\b/);
    await expect(today).not.toHaveClass(/\bon\b/);
    await expect(view(page)).toContainText('Fix the pedigree PDF');
    await today.click();
    await expect(view(page)).not.toContainText('Fix the pedigree PDF');
  });

  test('Apps table: search narrows the rows, a health chip filters, the clear button resets both', async ({ page, guard }) => {
    await HUBS.factory.open(page, guard);
    await go(page, 'all');
    const rows = view(page).locator('table.ptab tbody tr');
    const all = await rows.count();
    expect(all).toBeGreaterThan(1);
    await expect(view(page).locator('[data-action="pfclear"]')).toHaveCount(0);
    await view(page).locator('[data-f="pfq"]').fill('vet');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Vet Converter');
    await expect(view(page).locator('[data-f="pfq"]')).toBeFocused(); // typing keeps the cursor in the box
    await view(page).locator('[data-action="pfclear"]').click();
    await expect(rows).toHaveCount(all);
    const chip = view(page).locator('[data-pf="h"]').first();
    await chip.click();
    await expect(chip).toHaveClass(/\bon\b/);
    expect(await rows.count()).toBeLessThanOrEqual(all);
    await view(page).locator('[data-action="pfclear"]').click();
    await expect(rows).toHaveCount(all);
  });
});

test.describe('JOB 34 Factory: state file messages', () => {
  test('no af-state.json yet: plain words saying the engine writes it', async ({ page, guard }) => {
    await page.goto('factory/#/rooms');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(view(page)).toContainText('af-state.json not found yet');
  });

  test('two af-state.json files: says one must go and shows no stale rooms', async ({ page, guard }) => {
    const { build } = require('../fixtures/factory/state');
    const logs = require('../support/world').IDS.factoryLogs;
    guard.world.folder(logs, 'AF logs (sample)');
    for (const id of ['af-state-SAMPLE-1', 'af-state-SAMPLE-2']) guard.world.file(id, 'af-state.json', JSON.stringify(build(Date.now())), { parents: [logs], mimeType: 'application/json' });
    await page.goto('factory/#/rooms');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(view(page)).toContainText('Two af-state.json files. One must go.');
    await expect(view(page).locator('section.room')).toHaveCount(0);
  });
});

test.describe('JOB 34 Factory: keyboard', () => {
  test('Tab reaches every bottom tab and Enter opens it', async ({ page, guard }) => {
    await HUBS.factory.open(page, guard);
    for (const tab of ['me', 'rooms', 'decide', 'do', 'docs', 'today']) {
      const a = page.locator(`nav a[data-nav="${tab}"]`);
      let reached = false;
      for (let i = 0; i < 120 && !reached; i++) { await page.keyboard.press('Tab'); reached = await a.evaluate((el) => el === document.activeElement); }
      expect(reached, tab + ' reached by Tab').toBe(true);
      await page.keyboard.press('Enter');
      await expect(a).toHaveAttribute('aria-current', 'page');
    }
  });
});

test.describe('JOB 34 Factory: phone', () => {
  test('390px: the address-only views (card, problem, queue, stuck, Not found) fit with no sideways scroll', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource: .*404/); // a card whose Drive card file is missing: the page shows the card without it
    const { sideScroll } = require('../fixtures/job34/load');
    await page.setViewportSize({ width: 390, height: 844 });
    await HUBS.factory.open(page, guard);
    for (const v of ['card/869fjxpc2', 'card/869fk9d1r', 'item/869fk9d1r', 'problem/869fjxpc2', 'queue/Claude', 'stuck', 'card/nope-SAMPLE']) {
      await go(page, v);
      expect(await sideScroll(page), v).toBe(false);
    }
    await view(page).locator('a[href="#/rooms"]').first().click(); // and the way back still works at phone width
    await expect(page).toHaveURL(/#\/rooms$/);
  });
});
