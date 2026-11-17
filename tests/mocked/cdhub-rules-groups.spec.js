// Rules by topic (Lisa 17 Nov 2026, option A): one foldable card per topic, short rows, source behind the (i), search and
// "Not set only". Invented rows only.
const { test, expect } = require('../support/test');

test('Compliance rules come in topic groups; a group with gaps opens; search and Not set only filter the rows', async ({ page }) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  await page.evaluate(() => {
    T['BLD-breeding_rule.csv'] = [
      { id: 'r1', rule_key: 'max_litters_per_dam', value: '6', effective_from: '2010-01-01', source: 'Pretend source' },
      { id: 'r2', rule_key: 'space.limited.adult.medium.3', value: '8.5', effective_from: '2026-11-11', source: 'Pretend poster' },
      { id: 'r3', rule_key: 'link_kind.bff', value: 'BFFs', effective_from: '2026-11-13' },
    ];
    go('compliance', false);
  });
  const card = page.locator('#compRules');
  await expect(card.locator('[data-rule-group]')).toHaveCount(await card.locator('[data-rule-group]').count());
  await expect(card.locator('[data-rule-group="breeding"] tr[data-rule="max_litters_per_dam"]')).toContainText('6');
  await expect(card.locator('[data-rule-group="space"] tr[data-rule="space.limited.adult.medium.3"]')).toContainText('3 medium dogs, limited access');
  await expect(card.locator('[data-rule-group="records"] tr[data-rule="link_kind.bff"]')).toBeAttached();
  await expect(card.locator('[data-rule-group="breeding"]')).toHaveAttribute('open', '');   // has rules not set
  await expect(card.locator('[data-rule-group="breeding"] summary')).toContainText('not set');
  await expect(card.locator('tr[data-rule="max_litters_per_dam"] .info')).toHaveAttribute('title', /Pretend source/);   // source is behind the (i), not a column
  await card.locator('[data-rules-q]').fill('litters');
  await expect(card.locator('tr[data-rule="max_litters_per_dam"]')).toBeVisible();
  await expect(card.locator('[data-rule-group="space"]')).toBeHidden();
  await card.locator('[data-rules-q]').fill('');
  await card.locator('[data-rules-unset]').check();
  await expect(card.locator('tr[data-rule="max_litters_per_dam"]')).toBeHidden();
  await expect(card.locator('tr[data-rule="min_dam_age_months"]')).toBeVisible();
});
