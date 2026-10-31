// JOB 32 Stage 2: each stage shows its checks as pass, fail or not run with a count; template rule lines sit in a closed fold.
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/factory/state');
const { add } = require('../fixtures/factory/next');
const LOGS = require('../support/world').IDS.factoryLogs;

async function card(page, guard, id) {
  const now = Date.now();
  guard.world.folder(LOGS, 'AF logs (sample)');
  guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(add(build(now), now)), { parents: [LOGS], mimeType: 'application/json' });
  await page.goto('factory/#/card/' + id);
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('.hero h2')).toBeVisible();
}
const ck = (page, st, k) => page.locator('.stage[data-stage="' + st + '"] .ck[data-ck="' + k + '"]');

test.describe('Factory per-stage checks', () => {
  test('pass, fail and not run each show with a count; a stage with nothing says "not recorded"', async ({ page, guard }) => {
    await card(page, guard, 'appa00001');
    await expect(ck(page, 3, 'pass')).toHaveText('✓ 1 pass');
    await expect(ck(page, 3, 'fail')).toHaveText('✗ 1 fail');
    await expect(ck(page, 3, 'none')).toHaveCount(0);
    await expect(ck(page, 4, 'pass')).toHaveText('✓ 1 pass');
    await expect(ck(page, 4, 'none')).toHaveText('2 not run');
    await expect(ck(page, 5, 'none')).toHaveText('1 not run');
    await expect(ck(page, 6, 'none')).toHaveText('53 not run');   // template lines were never run for this app
    await expect(page.locator('.stage[data-stage="0"] .r .nr')).toHaveText('not recorded');
    // Rings, not fills: pass and not run are transparent; fail is a tint, never the ring colour itself.
    const s = await page.evaluate(() => ['pass', 'fail', 'none'].map((k) => { const c = getComputedStyle(document.querySelector('.ck[data-ck="' + k + '"]')); return [c.borderTopWidth, c.backgroundColor === c.borderTopColor, c.color === getComputedStyle(document.body).color]; }));
    expect(s).toEqual([['1px', false, true], ['1px', false, true], ['1px', false, true]]);
  });

  test('the 53 template rule lines sit in a closed fold that opens on a click', async ({ page, guard }) => {
    await card(page, guard, 'appa00001');
    await page.locator('.stage[data-stage="6"]').click();
    const fold = page.locator('details.fold[data-fold="6"]');
    await expect(fold).toHaveCount(1);
    await expect(fold).not.toHaveAttribute('open', '');
    await expect(fold.locator('summary')).toHaveText('53 rule lines');
    await expect(fold.locator('li').first()).toBeHidden();
    await fold.locator('summary').click();
    await expect(fold.locator('li', { hasText: 'Rule line 53' })).toBeVisible();
  });

  test('phone 390px: the card with checks and an open fold has no sideways scroll', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await card(page, guard, 'appa00001');
    await page.locator('.stage[data-stage="6"]').click();
    await page.locator('details.fold[data-fold="6"] summary').click();
    await page.locator('.stage[data-stage="3"]').click();
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(w[0]).toBeLessThanOrEqual(w[1]);
  });
});
