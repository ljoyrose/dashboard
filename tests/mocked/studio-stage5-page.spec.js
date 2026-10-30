// Studio stage 5 (engine v0.2.24), page side: each piece's Steps (item.tasks) in its details and on its own page, and a quiet
// line on the merit (stage 0) and approve (stage 7) gates from item.autoGate. Nothing shows when the engine sends neither field.
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
  const d = page.locator(`[data-panelbox="${id}"]`);
  if (!(await d.count())) await page.locator(`.crow[data-row="${id}"] .ttl`).first().click();
  await expect(d.first()).toBeVisible();
  return d.first();
};
const stepsIn = async (box) => {
  const li = box.locator('[data-steps] li');
  await expect(li).toHaveCount(4);
  await expect(li.nth(0)).toContainText('1.');
  await expect(li.nth(0)).toContainText('Draft the checklist');
  await expect(li.nth(0).locator('.tw')).toHaveText('Claude');
  await expect(li.nth(1).locator('.tw')).toHaveText('Grok');
  await expect(li.nth(2).locator('.tw')).toHaveText('Studio helper'); // plain words: never "Engine"
  await expect(li.nth(3).locator('.tw')).toHaveText('Lisa');
  await expect(li.locator('[data-chip="fit"]')).toHaveText(['AUTO', 'AUTO', 'AUTO', 'HAND']);
  await expect(li.nth(0).locator('[data-done]')).toBeVisible();
  await expect(li.nth(1)).toHaveAttribute('data-status', 'skipped');
  await expect(li.locator('[data-done]')).toHaveCount(1);
  await expect(box.locator('[data-steps]')).not.toContainText('Engine');
};

test.describe('Studio stage 5: steps and auto gates', () => {
  test('details panel shows the Steps list and the approve row says it stays with you', async ({ page, guard }) => {
    await open(page, guard, '#/decide');
    const row = page.locator('.crow[data-row="sa-rev1"]').first();
    await expect(row.locator('[data-autogate]')).toHaveText('Stays with you: Cost is over your cap');
    await expect(row.locator('[data-autogate]')).toHaveAttribute('data-autogate', 'you');
    await expect(page.locator('.crow[data-row="sa-rev2"] [data-autogate]')).toHaveCount(0);
    await stepsIn(await details(page, 'sa-rev1'));
    await expect((await details(page, 'sa-rev2')).locator('[data-steps]')).toHaveCount(0);
  });

  test('the asset page shows the Steps list', async ({ page, guard }) => {
    await open(page, guard, '#/asset/sa-rev1');
    const card = page.locator('#view .card').first();
    await expect(card.locator('[data-steps]')).toHaveCount(1);
    await stepsIn(card);
    await expect(card.locator('[data-autogate]')).toHaveText('Stays with you: Cost is over your cap');
  });

  test('a merit gate that passes by itself; no line off the gate stages', async ({ page, guard }) => {
    await open(page, guard, '#/ideas', (s) => {
      s.ideas[0].autoGate = { gate: 'merit', auto: true, why: 'Small and in budget' };
      s.assets.filter((a) => a.id === 'sa-make')[0].autoGate = { gate: 'approve', auto: false, why: 'Should not show' };
    });
    await expect(page.locator('.crow[data-row="si-1"] [data-autogate]')).toHaveText('Passes by itself');
    await page.evaluate(() => { location.hash = '#/asset/sa-make'; });
    await expect(page.locator('#view')).toContainText('Sample webclass slides');
    await expect(page.locator('#view [data-autogate]')).toHaveCount(0);
  });

  test('old state without the new fields shows nothing new', async ({ page, guard }) => {
    await open(page, guard, '#/asset/sa-rev1', (s) => {
      s.assets.concat(s.ideas).forEach((a) => { delete a.tasks; delete a.autoGate; });
      delete s.studio.autoGates; delete s.studio.lisaCap;
    });
    await expect(page.locator('#view')).toContainText('Sample checklist PDF');
    await expect(page.locator('#view [data-steps], #view [data-autogate]')).toHaveCount(0);
    await page.evaluate(() => { location.hash = '#/decide'; });
    await expect(page.locator('.crow[data-row="sa-rev1"]').first()).toBeVisible();
    await expect(page.locator('#view [data-autogate]')).toHaveCount(0);
  });

  test('390px phone: the asset page and open details fit with no sideways scroll', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, guard, '#/asset/sa-rev1');
    await expect(page.locator('#view [data-steps]').first()).toBeVisible();
    await page.locator('.crow[data-row="sa-rev1"] .ttl').first().click();
    await expect(page.locator('[data-panelbox="sa-rev1"] [data-steps]')).toBeVisible();
    const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, screen: window.innerWidth }));
    expect(w.doc).toBeLessThanOrEqual(w.screen + 1);
  });
});
