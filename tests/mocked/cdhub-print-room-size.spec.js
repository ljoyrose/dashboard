// Room card size comes from area_value. With no capacity rows, counts come from the space rules and that size.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const P = require('../support/print-a4');

const POSTER = [];
[['free', { small: [2.5, 2.5, 4.5, 6.0], medium: [2.5, 4.5, 6.0], large: [4.5, 6.0] }, { small: 5, medium: 5, large: 9 }],
 ['limited', { small: [4.5, 4.5, 6.5, 8.5], medium: [4.5, 6.5, 8.5], large: [6.5, 8.5] }, { small: 9, medium: 9, large: 13 }]].forEach(([mode, t, p]) => {
  Object.keys(t).forEach((sz) => t[sz].forEach((v, i) => POSTER.push({ rule_key: `space.${mode}.adult.${sz}.${i + 1}`, value: String(v), effective_from: '2026-01-01' })));
  Object.keys(p).forEach((sz) => POSTER.push({ rule_key: `space.${mode}.mum_with_pups.${sz}.1`, value: String(p[sz]), effective_from: '2026-01-01' }));
});

test('room card prints the area size @regression', async ({ page }) => {
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  await P.openCards(page, (t) => {
    t.area.forEach((a) => { a.area_value = '16.3'; a.area_unit_id = 'u-m2'; });
    t.area_capacity = [];
    t.area_access = [{ area_id: 'ar-a', access_type: 'limited', effective_from: '2026-01-01' }];
    t.breeding_rule = t.breeding_rule.concat(POSTER);
  });
  await page.getByRole('button', { name: 'Room cards' }).click();
  const card = page.locator('.rcard[data-room="ar-a"]');
  await expect(card.locator('[data-k="area"] dd')).toHaveText('16.3 m²');
  await expect(card.locator('[data-k="access"] dd')).toHaveText('Limited access');
  await expect(card.locator('[data-size="small"] .n')).toHaveText('= 4');
  await expect(card.locator('[data-size="medium"] .n')).toHaveText('= 3');
  await expect(card.locator('[data-size="large"] .n')).toHaveText('= 2');
  await expect(card.locator('[data-k="pups"] dd')).toHaveText('Yes');
  await expect(card.locator('[data-k="pups"] small')).toHaveText('S/M/L');
  await card.screenshot({ path: path.join('/opt/cursor/artifacts', 'room-card.png') });
});
