// Factory Send gate and Prompts view: every state the factory-find "Factory send gate" block does not already cover.
// Pretend Google and Drive only; the data is tests/fixtures/factory/state.js plus invented text here.
const crypto = require('crypto');
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/factory/state');

const LOGS = require('../support/world').IDS.factoryLogs; // the Drive folder the page reads af-state.json from

async function open(page, guard, hash, { change, now } = {}) {
  const state = build(now || Date.now());
  if (change) change(state);
  guard.world.folder(LOGS, 'AF logs (sample)');
  guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(state), { parents: [LOGS], mimeType: 'application/json' });
  await page.goto('factory/' + hash);
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#appPick')).toBeVisible();
}

const ID = '869fk9d1r'; // the fixture's one fully-lined open send (Sample Links)
const PROMPT_DOC = '1SAMPLEpromptDocId00000000000';
const PROMPT_TEXT = 'Invented prompt text for the gate test.\nTHE WORK.\n1. Do one invented thing.\n';
const send = (st, id) => st.lists.sends.find((t) => t.id === id);
const sha = (x) => crypto.createHash('sha256').update(x, 'utf8').digest('hex');
const ukDay = (ts) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const today = () => ukDay(Date.now());
const stamp = (st, line, id = ID) => { const t = send(st, id); t.desc = t.desc.replace(/\npresend:[^\n]*/, line ? '\n' + line : ''); };
const copyBtn = (page, id = ID) => page.locator(`[data-copy="${id}"]`);
const gate = (page, id = ID) => page.locator(`[data-gate="${id}"]`);
const clip = (page) => page.evaluate(() => navigator.clipboard.readText());

test.describe('Factory send gate: stamp states', () => {
  test('the last presend line wins: NOT READY comment after a READY description locks Copy', async ({ page, guard }) => {
    await open(page, guard, '#/item/' + ID, { change: (st) => { send(st, ID).cm = [{ by: 'Claude', at: Date.now(), text: 'presend: NOT READY (1 FAIL)' }]; } });
    await expect(copyBtn(page)).toHaveCount(0);
    await expect(gate(page)).toHaveText('Checker: NOT READY');
  });

  test('the last presend line wins: READY comment after a NOT READY description unlocks Copy', async ({ page, guard }) => {
    await open(page, guard, '#/item/' + ID, { change: (st) => {
      stamp(st, 'presend: NOT READY (2 FAIL)');
      send(st, ID).cm = [{ by: 'Claude', at: Date.now(), text: 'presend: READY sha256:' + 'ef'.repeat(32) + ' ' + today() }];
    } });
    await expect(gate(page)).toHaveCount(0);
    await expect(copyBtn(page)).toBeVisible();
  });

  test('uppercase hex and a "30 Oct"-style date that is today count as READY, and Copy matches the lower-cased hash', async ({ page, guard }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    guard.world.file(PROMPT_DOC, 'prompt-sample.md', PROMPT_TEXT, { mimeType: 'text/markdown' });
    const d = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' });
    await open(page, guard, '#/item/' + ID, { change: (st) => stamp(st, 'presend: READY sha256:' + sha(PROMPT_TEXT.trim()).toUpperCase() + ' ' + d) });
    await expect(gate(page)).toHaveCount(0);
    await copyBtn(page).click();
    await expect(copyBtn(page)).toContainText('Copied');
    expect(await clip(page)).toBe(PROMPT_TEXT);
  });

  test('a malformed READY line (63 hex characters) counts as NOT READY', async ({ page, guard }) => {
    await open(page, guard, '#/item/' + ID, { change: (st) => stamp(st, 'presend: READY sha256:' + 'a'.repeat(63) + ' ' + today()) });
    await expect(copyBtn(page)).toHaveCount(0);
    await expect(gate(page)).toHaveText('Checker: NOT READY');
  });

  test('several lines missing: the gate names each in order, the checker reason last', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk6k00', { change: (st) => { send(st, '869fk6k00').tags.push('leak-open'); } });
    await expect(copyBtn(page, '869fk6k00')).toHaveCount(0);
    await expect(gate(page, '869fk6k00')).toHaveText('Last turn · Prediction · Happy Hour · After send · Lisa available · Class · No checker stamp');
  });

  test('a closed send (done) shows no gate and no Copy, even with every line present', async ({ page, guard }) => {
    await open(page, guard, '#/prompts', { change: (st) => { send(st, '869fk9d1n').desc = send(st, ID).desc; } });
    const sentRow = page.locator('#view details[data-sec="sent"] .crow[data-row="869fk9d1n"]');
    await expect(sentRow).toHaveCount(1);
    await expect(sentRow.locator('[data-gate], [data-copy]')).toHaveCount(0);
    await page.goto('factory/#/item/869fk9d1n');
    await expect(page.locator('.crow[data-row="869fk9d1n"]').first()).toBeVisible();
    await expect(page.locator('[data-gate="869fk9d1n"], [data-copy="869fk9d1n"]')).toHaveCount(0);
  });
});

test.describe('Factory send gate: Copy', () => {
  const SECTIONED = '# P1 Invented first step\nMake one sample table.\n\n# P2 Invented second step\nLock the sample table.\nCheck it twice.\n\n# P3 Invented third step\nNothing yet.\n';
  const P2 = '# P2 Invented second step\nLock the sample table.\nCheck it twice.';
  const named = (st) => { send(st, ID).name = 'Links · P2 · Lock the sample table'; };

  test('sectioned doc: a stamp of the trimmed P2 section copies exactly that section', async ({ page, guard }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    guard.world.file(PROMPT_DOC, 'prompt-sample.md', SECTIONED, { mimeType: 'text/markdown' });
    await open(page, guard, '#/item/' + ID, { change: (st) => { named(st); stamp(st, 'presend: READY sha256:' + sha(P2) + ' ' + today()); } });
    await copyBtn(page).click();
    await expect(copyBtn(page)).toContainText('Copied');
    expect(await clip(page)).toBe(P2);
  });

  test('sectioned doc: a stamp of the whole doc is refused', async ({ page, guard }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    guard.world.file(PROMPT_DOC, 'prompt-sample.md', SECTIONED, { mimeType: 'text/markdown' });
    await open(page, guard, '#/item/' + ID, { change: (st) => { named(st); stamp(st, 'presend: READY sha256:' + sha(SECTIONED.trim()) + ' ' + today()); } });
    await page.evaluate(() => navigator.clipboard.writeText('sample sentinel'));
    await copyBtn(page).click();
    await expect(page.locator('#banner')).toContainText('Not copied: the text is not the one the checker stamped');
    await expect(copyBtn(page)).not.toContainText('Copied');
    expect(await clip(page)).toBe('sample sentinel');
  });

  test('the prompt doc is missing in Drive (404): Not copied', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource.*404/);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, guard, '#/item/' + ID, { change: (st) => stamp(st, 'presend: READY sha256:' + sha(PROMPT_TEXT.trim()) + ' ' + today()) });
    await copyBtn(page).click();
    await expect(page.locator('#banner')).toContainText('Not copied: Drive said 404');
    await expect(copyBtn(page)).not.toContainText('Copied');
  });

  test('Drive fails reading the prompt doc (500, after the retries): Not copied', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource.*500/);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    guard.world.file(PROMPT_DOC, 'prompt-sample.md', PROMPT_TEXT, { mimeType: 'text/markdown' });
    await open(page, guard, '#/item/' + ID, { change: (st) => stamp(st, 'presend: READY sha256:' + sha(PROMPT_TEXT.trim()) + ' ' + today()) });
    guard.world.failFor = PROMPT_DOC;
    guard.world.failWith = { status: 500, reason: 'backendError' };
    await copyBtn(page).click();
    await expect(page.locator('#banner')).toContainText('Not copied: Drive said 500', { timeout: 20_000 });
    await expect(copyBtn(page)).not.toContainText('Copied');
  });

  test('no "Prompt …:" line and only Prediction / Simulation Drive links: never copies the Prediction doc', async ({ page, guard }) => {
    await open(page, guard, '#/item/' + ID, { change: (st) => { const t = send(st, ID); t.desc = t.desc.replace(/\nPrompt text:[^\n]*/, ''); } });
    await copyBtn(page).click();
    await expect(page.locator('#banner')).toHaveText('No prompt doc on this task.');
    expect(guard.world.calls.some((c) => c.url.includes('alt=media') && !c.url.includes('af-state'))).toBe(false);
  });

  test('a "Prompt doc:" line after the Prediction line is the one copied', async ({ page, guard }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const OTHER = '1SAMPLEpromptDocOther000000000';
    guard.world.file(OTHER, 'prompt-other-sample.md', PROMPT_TEXT, { mimeType: 'text/markdown' });
    await open(page, guard, '#/item/' + ID, { change: (st) => {
      const t = send(st, ID);
      t.desc = t.desc.replace(/\nPrompt text:[^\n]*/, '') + '\nPrompt doc: https://drive.google.com/file/d/' + OTHER + '/view';
      stamp(st, 'presend: READY sha256:' + sha(PROMPT_TEXT.trim()) + ' ' + today());
    } });
    await copyBtn(page).click();
    await expect(copyBtn(page)).toContainText('Copied');
    expect(await clip(page)).toBe(PROMPT_TEXT);
  });

  test('no prompt doc link on the task: "No prompt doc on this task."', async ({ page, guard }) => {
    await open(page, guard, '#/item/' + ID, { change: (st) => {
      const t = send(st, ID);
      // No Drive file link at all: the Prediction and Simulation links point elsewhere (invented addresses).
      t.desc = t.desc.replace(/\nPrompt text:[^\n]*/, '').replace(/Prediction: \S+ · Simulation: \S+/, 'Prediction: https://notes.example.test/prediction · Simulation: https://notes.example.test/simulation');
    } });
    await copyBtn(page).click();
    await expect(page.locator('#banner')).toHaveText('No prompt doc on this task.');
    expect(guard.world.calls.some((c) => c.url.includes('alt=media') && !c.url.includes('af-state'))).toBe(false);
  });

  test('the gate goes stale between render and click (UK midnight passes): Copy re-renders locked, nothing copied', async ({ page, guard }) => {
    const T = Date.parse('2026-10-30T23:55:00Z'); // GMT in late October: 23:55 in London
    await page.clock.install({ time: T });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    guard.world.file(PROMPT_DOC, 'prompt-sample.md', PROMPT_TEXT, { mimeType: 'text/markdown' });
    await open(page, guard, '#/item/' + ID, { now: T, change: (st) => stamp(st, 'presend: READY sha256:' + sha(PROMPT_TEXT.trim()) + ' ' + ukDay(T)) });
    await expect(copyBtn(page)).toBeVisible();
    await page.evaluate(() => navigator.clipboard.writeText('sample sentinel'));
    await page.clock.setSystemTime(T + 10 * 60e3); // 00:05 on 31 Oct in London
    await copyBtn(page).click();
    await expect(copyBtn(page)).toHaveCount(0);
    await expect(gate(page)).toContainText('Checker stamp not today');
    expect(await clip(page)).toBe('sample sentinel');
    expect(guard.world.calls.some((c) => c.url.includes(PROMPT_DOC))).toBe(false);
  });
});

test.describe('Factory Prompts view', () => {
  const v = (page) => page.locator('#view [data-prompts]');
  // [data-ps id, section] for each .pitem in page order.
  const order = (page) => page.locator('#view [data-prompts] .pitem').evaluateAll((els) => els.map((e) => {
    let s = e.previousElementSibling; while (s && !s.matches('.grpt')) s = s.previousElementSibling;
    return [e.querySelector('[data-ps]').getAttribute('data-ps'), s ? s.getAttribute('data-sec') : ''];
  }));
  const extra = (st, o) => st.lists.sends.push({ ...send(st, '869fk6k00'), desc: '', cm: [], ...o });

  test('READY first, then by created; one top per app, the higher P under Waiting', async ({ page, guard }) => {
    const now = Date.now(), H = 36e5;
    await open(page, guard, '#/prompts', { now, change: (st) => {
      extra(st, { id: '869fkx001', name: 'Vet Converter · P3 · Import screen', tags: ['app-869fjxpc9'], created: now - 9 * H, url: 'https://app.clickup.com/t/869fkx001' });
      extra(st, { id: '869fkx002', name: 'Kennel Book · P1 · Sign in', tags: ['app-869fk9834'], created: now - H, url: 'https://app.clickup.com/t/869fkx002' });
    } });
    expect(await order(page)).toEqual([
      ['869fk9d1r', 'next'], // READY, though the newest
      ['869fkx001', 'next'], // older than the Kennel Book P1
      ['869fkx002', 'next'], // Kennel Book's lowest P
      ['869fk6k00', 'waiting'], // Kennel Book P2 waits behind P1
    ]);
    await expect(v(page).locator('[data-sec="next"]')).toContainText('3');
    await expect(v(page).locator('[data-sec="waiting"]')).toContainText('1');
  });

  test('Sent count, and the rules list', async ({ page, guard }) => {
    await open(page, guard, '#/prompts', { change: (st) => { extra(st, { id: '869fkx003', name: 'Kennel Book · P0 · Setup', status: 'done', url: 'https://app.clickup.com/t/869fkx003' }); } });
    await expect(v(page).locator('details[data-sec="sent"] summary')).toHaveText(/Sent · 2/);
    const rules = v(page).locator('details[data-sec="rules"] li');
    await expect(rules).toHaveCount(4);
    await expect(rules.nth(0)).toContainText('Copy shows only when the task carries');
    await expect(rules.nth(1)).toContainText('Copy refuses text that does not match the stamp');
    await expect(rules.nth(2)).toContainText('Nothing that was not run counts as a pass');
    await expect(rules.nth(3)).toContainText('Lisa available');
  });

  test('TEST- sends are hidden unless the Do tab\'s TEST filter is on', async ({ page, guard }) => {
    await open(page, guard, '#/prompts');
    await expect(v(page).locator('[data-ps="869fk6jzc"]')).toHaveCount(0);
    await page.goto('factory/#/do');
    await page.locator('#filtersBtn').click();
    await page.locator('.fpanel [data-action="ftest"]').click();
    await expect(page).toHaveURL(/test=1/);
    await page.locator('#view [data-prompts-link]').click();
    await expect(v(page).locator('[data-ps="869fk6jzc"]')).toHaveCount(1);
  });

  test('no open sends: "Nothing to send." and no Prompts link under Do', async ({ page, guard }) => {
    await open(page, guard, '#/prompts', { change: (st) => { st.lists.sends.forEach((t) => { t.status = 'done'; }); } });
    await expect(v(page)).toContainText('Nothing to send.');
    await expect(v(page).locator('.pitem')).toHaveCount(0);
    await expect(v(page).locator('details[data-sec="sent"] summary')).toHaveText(/Sent · 3/);
    await page.goto('factory/#/do');
    await expect(page.locator('#view .crow').first()).toBeVisible();
    await expect(page.locator('#view [data-prompts-link]')).toHaveCount(0);
  });

  test('at 360 px wide, with Sent and Rules open, nothing scrolls sideways', async ({ page, guard }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await open(page, guard, '#/prompts');
    await v(page).locator('details[data-sec="sent"] summary').click();
    await v(page).locator('details[data-sec="rules"] summary').click();
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw).toBeLessThanOrEqual(cw);
  });

  test('badge colours come from the tokens: READY wears ok (--ljr-5), the rest do not (--ljr-2)', async ({ page, guard }) => {
    await open(page, guard, '#/prompts');
    const ready = v(page).locator('[data-ps="869fk9d1r"]'), not = v(page).locator('[data-ps="869fk6k00"]');
    await expect(ready).toHaveClass(/\bok\b/);
    await expect(not).not.toHaveClass(/\bok\b/);
    const tok = (name) => page.evaluate((n) => { const s = document.createElement('span'); s.style.borderColor = `var(${n})`; document.body.appendChild(s); const c = getComputedStyle(s).borderTopColor; s.remove(); return c; }, name);
    await expect(ready).toHaveCSS('border-top-color', await tok('--ljr-5'));
    await expect(not).toHaveCSS('border-top-color', await tok('--ljr-2'));
    expect(await tok('--ljr-5')).not.toBe(await tok('--ljr-2'));
  });
});
