// Studio Stage 7 page side (engine v0.2.24, bot maker loop): who is making a piece, the automatic check's verdict
// chips and reasons, and the one-line bot settings summary. Nothing shows when the fields are absent.
// Pretend Google and Drive only; the data is tests/fixtures/studio/state.js (invented).
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

async function open(page, guard, hash, change) {
  await page.clock.setFixedTime(NOW);
  const s = build(NOW.getTime());
  if (change) change(s);
  guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
  guard.world.file('studio-state-sample', ST.stateFile, JSON.stringify(s), { parents: [ST.logsFolderId], mimeType: 'application/json' });
  await page.goto('studio/' + hash);
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#enginePill')).toBeVisible();
}
const details = async (page, id) => {
  const d = page.locator(`[data-more="${id}"]`);
  if (!(await d.count())) await page.locator(`.crow[data-row="${id}"] .ttl`).first().click();
  await expect(d).toBeVisible();
  return d;
};
const noSidewaysScroll = async (page) => {
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, screen: window.innerWidth }));
  expect(w.doc).toBeLessThanOrEqual(w.screen + 1);
};

test.describe('Studio Stage 7: bot maker loop', () => {
  test('a claimed piece shows who is making it and since when; the check-wait chip shows in its details', async ({ page, guard }) => {
    await open(page, guard, '#/asset/sa-make');
    const card = page.locator('.crow[data-row="sa-make"]');
    await expect(card.locator('[data-claim]')).toHaveText('Grok is making this · since 09:10');
    await expect(card.locator('[data-claim]')).toHaveClass(/muted/);
    const d = await details(page, 'sa-make');
    await expect(d.locator('[data-chip="check-wait"]')).toHaveText('Waiting for check');
    await expect(d.locator('[title="Flag"]')).toHaveCount(0); // no raw flag word beside it
  });

  test('Claude claims read likewise; check notes show on stages 5 to 7 only; failed and approved chips', async ({ page, guard }) => {
    await open(page, guard, '#/review', (s) => {
      const x = (id) => s.assets.find((a) => a.id === id);
      Object.assign(x('sa-rev1'), { claim: { by: 'claude', at: new Date(NOW.getTime() - 30 * 60e3).toISOString() }, flags: ['auto-approved'], checkNotes: 'Sample: all clear' });
      Object.assign(x('sa-rev2'), { flags: ['check-failed'] });
      Object.assign(x('sa-hand'), { checkNotes: 'Sample note on stage 4' }); // stage 4: not shown
    });
    await expect(page.locator('.crow[data-row="sa-rev1"] [data-claim="claude"]')).toHaveText('Claude is making this · since 09:40');
    await expect(page.locator('.crow[data-row="sa-rev1"] [data-check]')).toHaveText('Check: Sample: all clear');
    await expect(page.locator('.crow[data-row="sa-rev2"] [data-check]')).toHaveText('Check: Sample note: subject line is long');
    await expect((await details(page, 'sa-rev2')).locator('[data-chip="check-failed"]')).toHaveText('Check failed');
    await expect((await details(page, 'sa-rev1')).locator('[data-chip="auto-approved"]')).toHaveText('Approved by check');
    await page.goto('studio/#/asset/sa-hand');
    await expect(page.locator('.crow[data-row="sa-hand"]')).toBeVisible();
    await expect(page.locator('.crow[data-row="sa-hand"] [data-check]')).toHaveCount(0);
  });

  test('the bot settings line shows when present and never prints the folder id', async ({ page, guard }) => {
    await open(page, guard, '#/engine');
    await expect(page.locator('[data-maker]')).toHaveText('Bots: auto-approve on · £2 a piece');
    await expect(page.locator('body')).not.toContainText('sample-in-progress-folder');
  });

  test('old state without the new fields renders exactly as before: no claim, check or bot lines', async ({ page, guard }) => {
    await open(page, guard, '#/asset/sa-make', (s) => {
      delete s.studio.maker;
      [...s.assets, ...s.ideas].forEach((a) => { delete a.claim; delete a.checkNotes; a.flags = (a.flags || []).filter((f) => !/^(auto-approved|check-failed|check-wait)$/.test(f)); });
    });
    await expect(page.locator('.crow[data-row="sa-make"]')).toBeVisible();
    await expect(page.locator('[data-claim], [data-check], [data-chip="check-wait"]')).toHaveCount(0);
    await page.goto('studio/#/engine');
    await expect(page.locator('#view')).toHaveAttribute('data-view', 'engine');
    await expect(page.locator('[data-maker]')).toHaveCount(0);
  });

  test('390px phone: the claim and check lines fit with no sideways scroll', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, guard, '#/review', (s) => {
      Object.assign(s.assets.find((a) => a.id === 'sa-rev2'), { claim: { by: 'grok', at: s.generated_at }, checkNotes: 'Sample long note '.repeat(12) });
    });
    await expect(page.locator('.crow[data-row="sa-rev2"] [data-check]')).toBeVisible();
    await noSidewaysScroll(page);
  });
});
