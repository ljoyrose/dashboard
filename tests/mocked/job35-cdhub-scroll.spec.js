const { test, expect } = require('../support/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { HUBS, go } = require('../support/hubs');

test('t-job35-cdhub-scroll-spec-1', async ({ page, guard }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await HUBS.cdhub.open(page, guard);
  const bad = [];
  for (const v of HUBS.cdhub.views) {
    await go(page, v);
    const res = await new AxeBuilder({ page }).withRules(['scrollable-region-focusable']).analyze();
    res.violations.forEach((x) => bad.push(`${v}: ${x.nodes.length} place(s), first ${x.nodes[0].target.join(' ')}`));
    const unnamed = await page.locator('.scroll:not([tabindex="0"][aria-label])').count();
    if (unnamed) bad.push(`${v}: ${unnamed} scroll box(es) without tabindex 0 and a name`);
  }
  expect(bad).toEqual([]);
});

