// Studio Stage 11 page side (engine v0.2.24): item.proofCheck shows one check chip in an item's details in place of the
// low-res + watermark reminder. Older state without proofCheck keeps the reminder as before. Invented data only.
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

async function open(page, guard, change) {
  await page.clock.setFixedTime(NOW);
  const s = build(NOW.getTime());
  change(s);
  guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
  guard.world.file('studio-state-sample', ST.stateFile, JSON.stringify(s), { parents: [ST.logsFolderId], mimeType: 'application/json' });
  await page.goto('studio/#/assets');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#enginePill')).not.toHaveClass(/\bhidden\b/); // drawn: Studio has read its state
  if (page.viewportSize().width > 600) await expect(page.locator('#enginePill')).toBeVisible(); // the pill shows on a desktop only (no room in the 56px phone bar)
}
async function details(page, id) {
  const d = page.locator(`[data-more="${id}"]`);
  if (!(await d.count())) await page.locator(`.crow[data-row="${id}"] .ttl`).first().click();
  await expect(d).toBeVisible();
  return page.locator(`[data-delivery="${id}"]`);
}
// One protected sample item; proofCheck is set per case (undefined = the field is left out, as in older state).
const sample = (proofCheck, needsWatermark) => (s) => {
  const c = s.assets.filter((a) => a.id === 'sa-client')[0];
  Object.assign(c, { protect: 'yes', paid: 'no', disclose: 'yes', hasProof: true, hasFinal: false, needsWatermark, proofLowRes: needsWatermark ? 'Proof: low-res (max 1200px wide) + watermark' : null });
  if (proofCheck !== undefined) c.proofCheck = proofCheck;
};

test.describe('Studio Stage 11: proof check chip', () => {
  const CASES = [
    ['ok', false, 'Proof ready'],
    ['hand', false, 'Proof added by hand'],
    ['missing', true, 'Proof due'],
    ['stale', true, 'Proof out of date'],
  ];
  for (const [val, wm, words] of CASES) {
    test(`proofCheck '${val}' shows "${words}" in place of the watermark reminder`, async ({ page, guard }) => {
      await open(page, guard, sample(val, wm));
      const box = await details(page, 'sa-client');
      const chip = box.locator('[data-chip="proofcheck"]');
      await expect(chip).toHaveText(words);
      await expect(chip).toHaveAttribute('data-check', val);
      await expect(chip).toHaveClass(/\btag\b/);
      await expect(box.locator('[data-chip="lowres"]')).toHaveCount(0);
      await expect(box.locator('[data-watermark]')).toHaveCount(0);
    });
  }

  test('proofCheck null (not protected): no check chip and no reminder', async ({ page, guard }) => {
    await open(page, guard, sample(null, false));
    const box = await details(page, 'sa-client');
    await expect(box.locator('[data-chip="proofcheck"]')).toHaveCount(0);
    await expect(box.locator('[data-chip="lowres"]')).toHaveCount(0);
  });

  test('proofCheck absent (older state): the low-res + watermark reminder shows as before', async ({ page, guard }) => {
    await open(page, guard, sample(undefined, true));
    const box = await details(page, 'sa-client');
    await expect(box.locator('[data-chip="proofcheck"]')).toHaveCount(0);
    await expect(box.locator('[data-chip="lowres"]')).toHaveText('Low-res + watermark');
    await expect(box.locator('[data-watermark]')).toHaveText('Add Studio watermark layer');
  });
});
