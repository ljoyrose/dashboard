// Factory find bar (20 Oct 2026): one bar on Me, Rooms, Decide, Do and Docs — search, app, kind, who, stage,
// flags, sort, TEST — plus the Me tab, the app picker and the two link forms bots send Lisa.
// Pretend Google and Drive only; the data is tests/fixtures/factory/state.js (invented).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/factory/state');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'factory', 'index.html'), 'utf8');
const LOGS = require('../support/world').IDS.factoryLogs; // the Drive folder the page reads af-state.json from

async function open(page, guard, hash, { sent, change } = {}) {
  const state = build(Date.now());
  if (change) change(state);
  guard.world.folder(LOGS, 'AF logs (sample)');
  guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(state), { parents: [LOGS], mimeType: 'application/json' });
  if (sent) await page.addInitScript((ids) => { const o = {}; ids.forEach((id) => { o[id] = Date.now(); }); localStorage.setItem('af-sent', JSON.stringify(o)); }, sent);
  await page.goto('factory/' + hash);
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#appPick')).toBeVisible();
}
const row = (page, id) => page.locator(`.crow[data-row="${id}"]`);
const rows = (page) => page.locator('#view .crow');
const chip = (page, fx, val) => page.locator(`#view [data-fx="${fx}"][data-val="${val}"]`);
const panel = async (page) => { await page.locator('#filtersBtn').click(); await expect(page.locator('.fpanel')).toBeVisible(); };

test.describe('Factory find bar', () => {
  test('a send named Links · P5 sits under its app Sample Links, two clicks from Do @regression', async ({ page, guard }) => {
    await open(page, guard, '#/do');
    await chip(page, 'app', 'links').click();
    await expect(page).toHaveURL(/#\/do\?app=links$/);
    const card = page.locator('.appcard[data-app="links"]');
    await expect(card.locator('.grp')).toContainText('Sample Links');
    await expect(card.locator('.crow[data-row="869fk9d1r"] [data-copy]')).toBeVisible();
    await expect(page.locator('.appcard[data-app="factory"] .crow[data-row="869fk9d1r"]')).toHaveCount(0);
  });

  test('search: "/" puts the cursor in the box and words match name, app, tags and room', async ({ page, guard }) => {
    await open(page, guard, '#/do');
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('/');
    const box = page.locator('#view [data-f="fq"]');
    await expect(box).toBeFocused();
    expect(await box.getAttribute('placeholder')).toBeNull(); // no placeholder words
    await box.pressSequentially('gate');
    await expect(rows(page)).toHaveCount(1);
    await expect(row(page, '869fk9d1r')).toBeVisible();
    await expect(box).toBeFocused(); // typing keeps the cursor
    await box.fill('sample links');
    await expect(row(page, '869fk9d1r')).toBeVisible();
    await box.fill('rig pedigree'); // room name + words in the title
    await expect(rows(page)).toHaveCount(1);
    await expect(row(page, 'wrk000002')).toBeVisible();
  });

  test('app chips: counts in a circle, several at once, All clears them', async ({ page, guard }) => {
    await open(page, guard, '#/do');
    await expect(chip(page, 'app', 'kennel-book').locator('.cnt')).toHaveText('2');
    await chip(page, 'app', 'kennel-book').click();
    await chip(page, 'app', 'vet-converter').click();
    await expect(rows(page)).toHaveCount(3);
    await expect(page).toHaveURL(/app=kennel-book,vet-converter/);
    await chip(page, 'app', '').click();
    await expect(rows(page)).toHaveCount(4);
  });

  test('kind chips: Send, Test, Fix, Decide, Research', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    await chip(page, 'kind', 'send').click();
    await expect(rows(page)).toHaveCount(2);
    await chip(page, 'kind', 'send').click();
    await chip(page, 'kind', 'test').click();
    await expect(rows(page)).toHaveCount(1);
    await expect(row(page, 'wrk000001')).toBeVisible();
    await chip(page, 'kind', 'test').click();
    await chip(page, 'kind', 'fix').click();
    await expect(row(page, 'wrk000002')).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await chip(page, 'kind', 'fix').click();
    await chip(page, 'kind', 'research').click();
    await expect(row(page, 'dec000002')).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await chip(page, 'kind', 'research').click();
    await chip(page, 'kind', 'decide').click();
    await expect(rows(page)).toHaveCount(2);
  });

  test('who: Me shows only what is tagged for Lisa; Claude and Grok on Rooms', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    await panel(page);
    await chip(page, 'who', 'me').click();
    await expect(rows(page)).toHaveCount(2);
    await expect(row(page, 'wrk000001')).toBeVisible();
    await expect(row(page, 'wrk000002')).toBeVisible();
    await page.goto('factory/#/rooms');
    await panel(page);
    await chip(page, 'who', 'claude').click();
    await expect(page.locator('.rooms .chip')).toHaveCount(1);
    await expect(page.locator('.rooms .chip')).toContainText('Sample Links');
  });

  test('stage 0–8: chips say "Step N: Name" (words, not a number in a coloured ring), one stage at a time or several', async ({ page, guard }) => {
    await open(page, guard, '#/decide');
    await panel(page);
    const s1 = chip(page, 'st', '1');
    await expect(s1).toHaveAttribute('title', 'Research');
    await expect(s1).toContainText('Step 1: Research');
    await s1.click();
    await expect(rows(page)).toHaveCount(1);
    await expect(row(page, 'dec000002')).toBeVisible();
    await chip(page, 'st', '4').click();
    await expect(rows(page)).toHaveCount(2);
    await expect(page).toHaveURL(/st=1,4/);
  });

  test('flags: Urgent, Unflagged, Overdue; Unanswered hides what you already clicked', async ({ page, guard }) => {
    await open(page, guard, '#/decide', { sent: ['dec000001'] });
    await expect(row(page, 'dec000001')).toHaveCount(0);
    await panel(page);
    await chip(page, 'f', 'unanswered').click();
    await expect(row(page, 'dec000001')).toBeVisible();
    await chip(page, 'f', 'urgent').click();
    await expect(rows(page)).toHaveCount(1);
    await expect(row(page, 'dec000004')).toBeVisible();
    await chip(page, 'f', 'urgent').click();
    await chip(page, 'f', 'unflagged').click();
    await expect(rows(page)).toHaveCount(1);
    await expect(row(page, 'dec000001')).toBeVisible();
    await page.goto('factory/#/do');
    await panel(page);
    await chip(page, 'f', 'overdue').click();
    await expect(rows(page)).toHaveCount(1);
    await expect(row(page, 'wrk000001')).toBeVisible();
  });

  test('sort: Flag, Date, Oldest and Newest change the order', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    await expect(rows(page).first()).toHaveAttribute('data-row', 'wrk000001'); // Me = newest first
    await panel(page);
    await chip(page, 'sort', 'age').click();
    await expect(rows(page).first()).toHaveAttribute('data-row', 'wrk000002');
    await chip(page, 'sort', 'flag').click();
    await expect(rows(page).first()).toHaveAttribute('data-row', 'dec000004');
    await chip(page, 'sort', 'date').click();
    await expect(rows(page).first()).toHaveAttribute('data-row', 'wrk000001');
    await expect(page).toHaveURL(/sort=date/);
  });

  test('TEST items are hidden until the TEST switch is on', async ({ page, guard }) => {
    await open(page, guard, '#/do');
    await expect(row(page, '869fk6jzc')).toHaveCount(0);
    await expect(page.locator('#nDo')).toHaveText('4');
    await panel(page);
    await page.locator('[data-action="ftest"]').click();
    await expect(row(page, '869fk6jzc')).toBeVisible();
    await expect(page.locator('#nDo')).toHaveText('5');
    await expect(page).toHaveURL(/test=1/);
  });

  test('ZZ_DELETE_ apps count as TEST: no chip, no room card, no docs until TEST is on', async ({ page, guard }) => {
    await open(page, guard, '#/docs?test=0');
    await expect(page.locator('#view [data-fx="app"]', { hasText: 'ZZ_DELETE_' })).toHaveCount(0);
    await page.goto('factory/#/rooms');
    await expect(page.locator('.rooms .chip', { hasText: 'ZZ_DELETE_' })).toHaveCount(0);
    await panel(page);
    await page.locator('[data-action="ftest"]').click();
    await expect(page.locator('.rooms .chip', { hasText: 'ZZ_DELETE_' })).toHaveCount(1);
  });

  test('Filter button counts what is on; Clear resets; each tab remembers its own', async ({ page, guard }) => {
    await open(page, guard, '#/do');
    await expect(page.locator('#nFilters')).toHaveText('');
    await chip(page, 'app', 'links').click();
    await expect(page.locator('#nFilters')).toHaveText('1');
    await page.locator('[data-nav="decide"]').click();
    await expect(page).toHaveURL(/#\/decide$/);
    await expect(rows(page)).toHaveCount(3);
    await page.locator('[data-nav="do"]').click();
    await expect(page).toHaveURL(/#\/do\?app=links/);
    await panel(page);
    await page.locator('.fpanel [data-action="clearf"]').click();
    await expect(page).toHaveURL(/#\/do$/);
    await expect(page.locator('#nFilters')).toHaveText('');
    await expect(rows(page)).toHaveCount(4);
  });

  // House look (28 Oct): a friendly empty state in plain words with a green-ring check, never a "0" in a ring.
  test('nothing found: plain words with a green-ring check, and Clear', async ({ page, guard }) => {
    await open(page, guard, '#/decide?q=zzzz');
    const box = page.locator('[data-empty]');
    await expect(box).toBeVisible();
    await expect(box.locator('.cnt')).toHaveCount(0);
    await expect(box).toHaveText(/^\s*Nothing matches these filters\.\s*Clear\s*$/);
    await box.locator('[data-action="clearf"]').click();
    await expect(rows(page)).toHaveCount(3);
  });

  test('Me: first tab, counts what waits on Lisa across Decide and Do, newest first, by app', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    await expect(page.locator('nav.tabs a').first()).toHaveAttribute('data-nav', 'me');
    await expect(page.locator('#nMe')).toHaveText('7');
    await expect(rows(page)).toHaveCount(7);
    await expect(page.locator('#view .appcard').first()).toHaveAttribute('data-app', 'vet-converter');
    await expect(page.locator('.appcard[data-app="links"] .crow')).toHaveCount(2); // a decision and a send, one card
    await expect(page.locator('.appcard[data-app="links"] [data-act="yes"]')).toBeVisible();
    await expect(page.locator('.appcard[data-app="links"] [data-act="done"]')).toBeVisible();
  });

  test('Rooms and Docs use the same bar', async ({ page, guard }) => {
    await open(page, guard, '#/rooms');
    await page.locator('#view [data-f="fq"]').fill('kennel');
    await expect(page.locator('.rooms .chip')).toHaveCount(1);
    await expect(page.locator('.rooms .chip')).toContainText('Kennel Book');
    await page.goto('factory/#/docs?app=links');
    await expect(page.locator('#view [data-fx="app"][data-val="links"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('.dtab')).toContainText('P5-GATE-v11');
  });

  test('app picker: one screen with that app\'s Decide, Do and Docs', async ({ page, guard }) => {
    await open(page, guard, '#/rooms');
    await page.locator('#appPick').click();
    await page.locator('#appMenu a[href="#/app/links"]').click();
    await expect(page).toHaveURL(/#\/app\/links$/);
    const card = page.locator('#view .appcard[data-app="links"]');
    await expect(card.locator('.grp').first()).toContainText('Sample Links');
    await expect(card.locator('.crow[data-row="dec000001"]')).toBeVisible();
    await expect(card.locator('.crow[data-row="869fk9d1r"]')).toBeVisible();
    await expect(card.locator('.dtab')).toContainText('P5-GATE-v11');
    await expect(page.locator('#appMenu')).toBeHidden();
  });

  test('link with filters: #/do?app=links&kind=send opens Do filtered', async ({ page, guard }) => {
    await open(page, guard, '#/do?app=links&kind=send');
    await expect(chip(page, 'app', 'links')).toHaveClass(/\bon\b/);
    await expect(rows(page)).toHaveCount(1);
    await expect(row(page, '869fk9d1r')).toBeVisible();
    await expect(page).toHaveURL(/#\/do\?app=links&kind=send$/);
  });

  test('link to one item: #/item/<ClickUp id> opens that card expanded', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk9d1r');
    const card = page.locator('#view [data-item="869fk9d1r"]');
    await expect(card.locator('.grp')).toContainText('Sample Links');
    await expect(card.locator('.why')).toContainText('Send 2 of 2.');
    await expect(card.locator('[data-copy="869fk9d1r"]')).toBeVisible();
    await page.goto('factory/#/item/nosuchid0');
    await expect(page.locator('[data-empty] .empty')).toHaveText('That item is done or gone. Nothing to do here.');
  });
});

// Copy on a Sends card only when the checks before a paid send are written on the task (APPFACT E11, E14, E15, E16).
test.describe('Factory send gate', () => {
  const send = (st, id) => st.lists.sends.find((t) => t.id === id);
  const hm = (ts) => new Date(ts).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false });

  test('all five lines present: Copy shows, with the Happy Hour reading, the after-send block and when Lisa is free', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk9d1r');
    await expect(page.locator('[data-copy="869fk9d1r"]')).toBeVisible();
    const info = page.locator('[data-sendinfo="869fk9d1r"]');
    await expect(info).toContainText('Happy Hour: active');
    await expect(info).toContainText('AFTER SEND YOU MUST');
    await expect(info).toContainText('Lisa available: 16:00');
    await expect(info).toContainText('Class: CURRENT TEN:1');
  });

  test('no "Class: CURRENT … · DATA … · TARGET … (register id)" line locks Copy (E19)', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk9d1r', { change: (st) => { const t = send(st, '869fk9d1r'); t.desc = t.desc.replace(/\nClass:[^\n]*/, '\nClass: CURRENT TEN:1 · TARGET TEN:3'); } });
    await expect(page.locator('[data-copy="869fk9d1r"]')).toHaveCount(0);
    await expect(page.locator('[data-gate="869fk9d1r"]')).toHaveText(/Class/);
  });

  // Pre-send checker stamp (Presend Checker Landing, 30 Oct 2026): Copy needs "presend: READY sha256:<hash> <today>" and the text's hash must match.
  const PROMPT_DOC = '1SAMPLEpromptDocId00000000000';
  const PROMPT_TEXT = 'Invented prompt text for the gate test.\nTHE WORK.\n1. Do one invented thing.\n';
  const sha = (x) => require('crypto').createHash('sha256').update(x, 'utf8').digest('hex');
  const stamp = (st, line) => { const t = send(st, '869fk9d1r'); t.desc = t.desc.replace(/\npresend:[^\n]*/, line ? '\n' + line : ''); };
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

  test('no checker stamp: Copy is locked with a plain reason (the typed "inputs-gate: PASS" is not enough)', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk9d1r', { change: (st) => stamp(st, 'inputs-gate: PASS ' + today()) });
    await expect(page.locator('[data-copy="869fk9d1r"]')).toHaveCount(0);
    await expect(page.locator('[data-gate="869fk9d1r"]')).toHaveText(/No checker stamp/);
  });

  test('a NOT READY stamp (the latest stamp wins, here a comment) locks Copy', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk9d1r', { change: (st) => { send(st, '869fk9d1r').cm = [{ by: 'Claude', at: Date.now(), text: 'presend: NOT READY (3 FAIL, 1 NOT RUN) sha256:' + 'cd'.repeat(32) }]; } });
    await expect(page.locator('[data-copy="869fk9d1r"]')).toHaveCount(0);
    await expect(page.locator('[data-gate="869fk9d1r"]')).toHaveText(/Checker: NOT READY/);
  });

  test('a stale READY stamp (another day) locks Copy', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk9d1r', { change: (st) => stamp(st, 'presend: READY sha256:' + sha(PROMPT_TEXT) + ' 2020-01-01') });
    await expect(page.locator('[data-copy="869fk9d1r"]')).toHaveCount(0);
    await expect(page.locator('[data-gate="869fk9d1r"]')).toHaveText(/Checker stamp not today/);
  });

  test('wrong hash: a READY stamp for other text shows Copy, but Copy refuses the text', async ({ page, guard }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    guard.world.file(PROMPT_DOC, 'prompt-sample.md', PROMPT_TEXT, { mimeType: 'text/markdown' });
    await open(page, guard, '#/item/869fk9d1r', { change: (st) => stamp(st, 'presend: READY sha256:' + sha('some other invented text') + ' ' + today()) });
    await page.locator('[data-copy="869fk9d1r"]').click();
    await expect(page.locator('#banner')).toContainText('Not copied: the text is not the one the checker stamped');
    await expect(page.locator('[data-copy="869fk9d1r"]')).not.toContainText('Copied');
  });

  test('good stamp: READY, dated today, hash of the exact text: Copy copies it', async ({ page, guard }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    guard.world.file(PROMPT_DOC, 'prompt-sample.md', PROMPT_TEXT, { mimeType: 'text/markdown' });
    await open(page, guard, '#/item/869fk9d1r', { change: (st) => stamp(st, 'presend: READY sha256:' + sha(PROMPT_TEXT) + ' ' + today()) });
    await page.locator('[data-copy="869fk9d1r"]').click();
    await expect(page.locator('[data-copy="869fk9d1r"]')).toContainText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(PROMPT_TEXT);
  });

  test('Prompts: the next send per app on top with its checker state, then waiting; sent and rules folded away; reached from Do', async ({ page, guard }) => {
    await open(page, guard, '#/do');
    await page.locator('#view [data-prompts-link]').click();
    await expect(page).toHaveURL(/#\/prompts$/);
    const v = page.locator('#view [data-prompts]');
    await expect(v.locator('[data-ps="869fk9d1r"]')).toHaveText(/READY/);
    await expect(v.locator('[data-ps="869fk6k00"]')).toHaveText(/NOT READY · not checked/);
    await expect(v.locator('details[data-sec="sent"]')).not.toHaveAttribute('open', '');
    await expect(v.locator('details[data-sec="rules"]')).not.toHaveAttribute('open', '');
    await expect(v.locator('details[data-sec="sent"] .crow[data-row="869fk9d1n"]')).toHaveCount(1);
    await expect(v.locator('.pitem').first().locator('[data-ps]')).toHaveText(/^\s*READY/);
  });

  test('a send with none of the lines names each missing one instead of Copy', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk6k00');
    await expect(page.locator('[data-copy="869fk6k00"]')).toHaveCount(0);
    await expect(page.locator('[data-gate="869fk6k00"]')).toHaveText(/Last turn · Prediction · Happy Hour · After send/);
  });

  test('Last turn checked yesterday, or no simulation link, hides Copy', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk9d1r', { change: (st) => { const t = send(st, '869fk9d1r'); t.desc = t.desc.replace(/checked \S+/, 'checked 2020-01-01').replace(/ · Simulation: \S+/, ''); } });
    await expect(page.locator('[data-copy="869fk9d1r"]')).toHaveCount(0);
    await expect(page.locator('[data-gate="869fk9d1r"]')).toHaveText(/Last turn · Prediction/);
  });

  test('the Last turn line is also read from a comment ("checked 20 Oct" style)', async ({ page, guard }) => {
    const d = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' });
    await open(page, guard, '#/item/869fk9d1r', { change: (st) => { const t = send(st, '869fk9d1r'); t.desc = t.desc.replace(/\nLast turn:[^\n]*/, ''); t.cm = [{ by: 'Claude', at: Date.now(), text: 'Last turn: T56 = live chat, 682 credits, checked ' + d + ' ' + hm(Date.now()) + ' UK' }]; } });
    await expect(page.locator('[data-copy="869fk9d1r"]')).toBeVisible();
  });

  test('a Happy Hour reading older than 15 minutes hides Copy', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk9d1r', { change: (st) => { const t = send(st, '869fk9d1r'); t.desc = t.desc.replace(/read \d{2}:\d{2}/, 'read ' + hm(Date.now() - 20 * 60e3)); } });
    await expect(page.locator('[data-gate="869fk9d1r"]')).toHaveText(/Happy Hour/);
  });

  test('a leak or security send needs "Lisa available"; Lisa\'s Do lines for the app are linked', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk9d1r', { change: (st) => {
      const t = send(st, '869fk9d1r'); t.desc = t.desc.replace(/\nLisa available:[^\n]*/, '');
      st.lists.work.push({ ...st.lists.work[0], id: 'wrk000009', name: 'Sample Links · Be there for the leak tests', tags: ['who-lisa', 'app-869fjxpc2'], due: null });
    } });
    await expect(page.locator('[data-gate="869fk9d1r"]')).toHaveText(/Lisa available/);
    await expect(page.locator('[data-sendinfo="869fk9d1r"] a[href="#/item/wrk000009"]')).toBeVisible();
  });
});

// Selected and focus (house look, 28 Oct 2026, replaces the 20 Oct "single line" rule): a selected chip is the same 1px line
// drawn inside (outline 1px, offset -1px, nothing moves); a selected bottom tab only widens its colour bar (no ring); keyboard focus is a 2px ink ring.
test.describe('Factory selected and focus lines', () => {
  const st = (loc) => loc.evaluateAll((els) => els.map((e) => { const c = getComputedStyle(e); return { w: c.outlineWidth, s: c.outlineStyle, o: c.outlineOffset, shadow: c.boxShadow }; }));
  const selected = async (loc) => { const all = await st(loc); expect(all.length).toBeGreaterThan(0); all.forEach((x) => { expect(x).toEqual({ w: '1px', s: 'solid', o: '-1px', shadow: 'none' }); }); };

  test('after clicking a tab and a chip: selected chips wear the 1px inside line, the tab only its wider bar; focus is 2px @regression', async ({ page, guard }) => {
    await open(page, guard, '#/do');
    await page.locator('nav.tabs a[data-nav="me"]').click();
    const tab = page.locator('nav.tabs a[aria-current="page"]');
    await expect(tab).toHaveAttribute('data-nav', 'me');
    expect((await st(tab))[0].s).toBe('none');
    await expect(tab.locator('.bar')).toHaveCSS('width', '40px');
    await chip(page, 'app', 'kennel-book').click();
    await chip(page, 'app', '').click();
    await expect(chip(page, 'app', '')).toHaveClass(/\bon\b/);
    await page.mouse.move(0, 0);
    await selected(page.locator('#view .pill.on'));
    await chip(page, 'app', '').focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return [c.outlineWidth, c.outlineStyle]; });
    expect(f).toEqual(['2px', 'solid']);
    await panel(page);
    await page.locator('.fpanel [data-fx="st"]').first().click();
    await page.mouse.move(0, 0);
    await selected(page.locator('.fpanel .pill.on'));
    await page.goto('factory/#/new');
    await page.locator('#view .ch').first().click();
    await page.mouse.move(0, 0);
    await selected(page.locator('#view .ch.on'));
  });
});
