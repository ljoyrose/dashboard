// JOB 35 (30 Oct 2026) @regression: on a phone, Money Hub's sideways-scrolling tables were out of reach
// for keyboard users (axe scrollable-region-focusable, serious, on money and e/TESTCO; CI fonts made them overflow). Each scroll box is
// now a named, focusable region. Fails if any view at 390px has a scroll box a keyboard cannot reach.
const { test, expect } = require('../support/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { HUBS, go } = require('../support/hubs');

test('@regression Money Hub 390px: every sideways-scroll box can be reached by keyboard', async ({ page, guard }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await HUBS.money.open(page, guard);
  const bad = [];
  for (const v of HUBS.money.views) {
    await go(page, v);
    const res = await new AxeBuilder({ page }).withRules(['scrollable-region-focusable']).analyze();
    res.violations.forEach((x) => bad.push(`${v}: ${x.nodes.length} place(s), first ${x.nodes[0].target.join(' ')}`));
    const unnamed = await page.locator('.scroll:not([tabindex="0"][aria-label])').count();
    if (unnamed) bad.push(`${v}: ${unnamed} scroll box(es) without tabindex 0 and a name`);
  }
  expect(bad).toEqual([]);
});
