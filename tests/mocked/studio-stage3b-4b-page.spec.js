// Studio page, engine v0.2.24 fields (stages 3b + 4b): parked tools, playbook codes, and who does each playbook step and how.
// Pretend Google and Drive only; the data is tests/fixtures/studio/state.js (invented). Old state without the fields renders as before.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/studio/state');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const ST = ctx.window.DASH_CONFIG.studio;
const NOW = new Date('2026-10-28T10:10:00');
const UPLOAD = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files/;

async function open(page, guard, hash, change) {
  await page.clock.setFixedTime(NOW);
  const s = build(NOW.getTime());
  if (change) change(s);
  guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
  guard.world.file('studio-state-sample', ST.stateFile, JSON.stringify(s), { parents: [ST.logsFolderId], mimeType: 'application/json' });
  await page.goto('studio/' + hash);
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#enginePill')).not.toHaveClass(/\bhidden\b/); // drawn: Studio has read its state
  if (page.viewportSize().width > 600) await expect(page.locator('#enginePill')).toBeVisible(); // the pill shows on a desktop only (no room in the 56px phone bar)
}
async function uploads(page, guard) {
  const got = [];
  await page.route(UPLOAD, (route) => {
    const parts = route.request().postData().split(/\r\n--st\d+(?:--)?/).map((p) => p.slice(p.indexOf('\r\n\r\n') + 4)).filter((p) => p.trim().startsWith('{'));
    const meta = JSON.parse(parts[0]), body = JSON.parse(parts[1]), id = 'req-' + (got.length + 1);
    got.push({ meta, body, id });
    guard.world.file(id, meta.name, parts[1], { parents: meta.parents, mimeType: 'application/json' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id, name: meta.name }) });
  });
  return got;
}

test.describe('Studio: engine v0.2.24 page side', () => {
  test('the kit shows on the Kits page: P1 playbook with who · how on each step, and the pet card kit', async ({ page, guard }) => {
    await open(page, guard, '#/kits/playbooks');
    const pb = page.locator('[data-outcome="deliver"] [data-playbook="pb-app-launch"]');
    await expect(pb.locator('[data-chip="pb-code"]')).toHaveText('P1');
    await expect(pb.locator('.pbh b')).toHaveText('P1 Example app launch pack');
    await expect(pb.locator('li')).toHaveCount(8);
    await expect(pb.locator('li [data-chip="step-who"]')).toHaveText([
      'Lisa · by hand', 'Claude · AUTO', 'Claude · AUTO', 'Grok · AUTO', 'Lisa · by hand', 'Studio helper · AUTO', 'Lisa · by hand'
    ]);
    await expect(pb.locator('li').last().locator('[data-chip]')).toHaveCount(0); // who and fit both empty: no chip
    await expect(pb.locator('li').nth(2).locator('a')).toHaveText('Example pet card');
    // Old playbooks (no code, no who) look as before.
    const old = page.locator('[data-playbook="pb-launch"]');
    await expect(old.locator('[data-chip]')).toHaveCount(0);
    await expect(old.locator('li')).toHaveText(['Sample webclass funnel', 'Sample email kit', 'Post the replay link']);
    await page.locator('[data-kitnav="kits"]').click();
    await expect(page.locator('[data-kit="kit-pet-card"]')).toContainText('Example pet card');
    await expect(page.locator('[data-kit="kit-pet-card"] [data-cap="image-generate"]')).toBeVisible();
  });

  test('a step with only who or only fit shows no chip', async ({ page, guard }) => {
    await open(page, guard, '#/kits/playbooks', (s) => {
      const st = s.playbooks.find((p) => p.id === 'pb-app-launch').steps;
      st[0].fit = null; st[1].who = null;
    });
    const pb = page.locator('[data-playbook="pb-app-launch"]');
    await expect(pb.locator('li').nth(0).locator('[data-chip]')).toHaveCount(0);
    await expect(pb.locator('li').nth(1).locator('[data-chip]')).toHaveCount(0);
    await expect(pb.locator('[data-chip="step-who"]')).toHaveCount(5);
  });

  test('Tools: a parked tool carries a Parked chip; others do not', async ({ page, guard }) => {
    await open(page, guard, '#/tools', (s) => { s.tools[0].parked = true; s.tools[2].parked = true; });
    await expect(page.locator('[data-tool="Sample image tool"] [data-chip="parked"]')).toHaveText('Parked');
    await expect(page.locator('[data-tool="Sample video tool"] [data-chip="parked"]')).toHaveText('Parked');
    await expect(page.locator('[data-tool="Sample writing tool"] [data-chip="parked"]')).toHaveCount(0);
  });

  test('Tools: old state without parked shows no Parked chip', async ({ page, guard }) => {
    await open(page, guard, '#/tools');
    await expect(page.locator('[data-tool]').first()).toBeVisible();
    await expect(page.locator('[data-chip="parked"]')).toHaveCount(0);
  });

  test('library form: steps may end " @claude/AUTO"; the edit form keeps it, kit links still checked', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/kits/playbooks');
    await page.locator('[data-playbook="pb-app-launch"] [data-libedit]').click();
    const ef = page.locator('[data-libform="playbooks"]');
    const v = await ef.locator('[data-lf="steps"]').inputValue();
    expect(v.split('\n').slice(0, 3)).toEqual(['Agree the brief @lisa/HAND', 'Write the store listing @claude/AUTO', 'kit:kit-pet-card @claude/AUTO']);
    expect(v.split('\n')[7]).toBe('Say thank you');
    await ef.locator('[data-lf="steps"]').fill('kit:no-such-kit @claude/AUTO');
    await ef.locator('[data-action="libsend"]').click();
    await expect(ef.locator('[data-lfq="steps"] .ferr')).toHaveText('No kit called no-such-kit');
    await ef.locator('[data-lf="steps"]').fill('Write the copy @claude/AUTO\nkit:kit-pet-card @engine/AUTO\nPost it @lisa/HAND');
    await ef.locator('[data-action="libsend"]').click();
    await expect.poll(() => got.length).toBe(1);
    expect(got[0].body).toMatchObject({ kind: 'library', table: 'playbooks', op: 'edit', id: 'pb-app-launch',
      fields: { steps: ['Write the copy @claude/AUTO', 'kit:kit-pet-card @engine/AUTO', 'Post it @lisa/HAND'] } });
  });

  test('390px phone: the P1 playbook and the Tools page fit with no sideways scroll', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, guard, '#/kits/playbooks', (s) => { s.tools[0].parked = true; });
    await expect(page.locator('[data-playbook="pb-app-launch"] [data-chip="step-who"]').first()).toBeVisible();
    const fits = async () => { const w = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, s: window.innerWidth })); expect(w.d).toBeLessThanOrEqual(w.s + 1); };
    await fits();
    await page.evaluate(() => { location.hash = '#/tools'; });
    await expect(page.locator('[data-chip="parked"]')).toBeVisible();
    await fits();
  });
});
