// Owner hub small fixes (13 Nov 2026): dates as DD/MM/YY on Compliance and Data checks; hover is a grey fill only.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await page.waitForFunction(() => window.LOAD && LOAD.state === 'ok' && LOAD.later === 'ok');
};

test('Compliance and Data checks show mating, birth and litter dates as DD/MM/YY, never ISO', async ({ page }) => {
  await signIn(page);
  const text = await page.evaluate(() => {
    const L1 = { id: 'l1', dob: '2025-03-04' }, L2 = { id: 'l2', dob: '2025-09-10' };
    breedRuleRows = () => [{ rule_key: 'x', value: '12', effective_from: '2020-01-01' }];
    litterGaps = () => [{ dam: 'sub-test-dog-1', prev: L1, next: L2, days: 190, months: 12 }];
    damAgeBreaches = () => Object.assign([{ dam: 'sub-test-dog-1', on: '2025-01-02', dob: '2024-05-06', months: 12 }], { unest: 0 });
    litterCountBreaches = () => [{ dam: 'sub-test-dog-1', n: 5, max: 4, litter: L2 }];
    CD.tempSwaps = [{ area: 'area-1', date: '2026-01-15', min: '20.00', max: '12.00' }];
    go('map', false);
    const checks = (document.getElementById('checksCard') || {}).innerText || '';
    go('compliance', false);
    return checks + '\n' + document.getElementById('main').innerText;
  });
  expect(text).toContain('15/01/26');
  expect(text).toContain('02/01/25');
  expect(text).toContain('06/05/24');
  expect(text).toContain('04/03/25');
  expect(text).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
});

test('hover is the grey fill only: a tile or check-item keeps its border colour, a card title keeps its colour', async ({ page }) => {
  await signIn(page);
  const rules = await page.evaluate(() => {
    const out = [];
    for (const sh of document.styleSheets) {
      let rs; try { rs = sh.cssRules; } catch (e) { continue; }
      const walk = (list) => { for (const r of list) { if (r.cssRules) walk(r.cssRules); else if (r.selectorText && /:hover/.test(r.selectorText) && /(\.tile|\.ci|\.mcard)\b/.test(r.selectorText)) out.push(r.cssText); } };
      walk(rs);
    }
    return out;
  });
  for (const r of rules) {
    expect(r, r).not.toMatch(/border-color|(^|[^-])color:|outline:\s*(?!none)/);
  }
});
