// Lisa 18 Nov 2026 ("resolve"): batch use-by dates are month-only in any trade, so the Date formats check accepts
// year-month (2023-03, ISO 8601) as well as full dates, in every column. Nothing is given an invented day.
const { test, expect } = require('../support/test');

test('Date formats: year-month passes, a day-month-year date still fails', async ({ page }) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  const r = await page.evaluate(() => {
    const keep = T;
    T = { 'BLD-vaccination.csv': [{ id: 'v1', batch_use_by: '2023-03', given_on: '2022-05-01' }, { id: 'v2', batch_use_by: '2024-12', given_on: '2023-01-02' }],
          'BLD-weight.csv': [{ id: 'w1', performed_on: '02/03/2026' }] };
    const out = dateAudit();
    T = keep;
    return { bad: out.bad, month: [isISOMonth('2023-03'), isISOMonth('2023-13'), isISOMonth('2023-3'), isISOMonth('2023-03-01')] };
  });
  expect(r.bad).toEqual(['weight.performed_on (1, e.g. 02/03/2026)']);
  expect(r.month).toEqual([true, false, false, false]);
});
