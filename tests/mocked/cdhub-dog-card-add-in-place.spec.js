// Dog card "no …" lines open their add form in place (Lisa 15 Nov 2026): tapping "no weight" on a pup jumped to the top
// of the page. Now the weight section opens with Add weight inside the card, a save shows the tick there and the new
// weight shows at once; "no chip recorded" opens Edit at the microchip box. Invented rows only.
const { test, expect } = require('../support/test');
const { tabClick } = require('../support/tabs');

test('no weight: Add weight opens inside the card, no jump; the save ticks and the weight shows at once', async ({ page }) => {
  const sent = [];
  await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
    sent.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'w-new' } }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/AKfyTEST_only_123/exec');
    localStorage.setItem('cdhub.sink.code', 'test-code-1');
  });
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');

  const pup = page.locator('.dc').filter({ has: page.locator('details.wtc [data-k="weight"]', { hasText: /^no weight$/ }) }).first();
  const dogId = await pup.getAttribute('data-dog');
  const wt = pup.locator('details.wtc');
  await pup.scrollIntoViewIfNeeded();
  await page.evaluate(() => { window.__stay = 1; });
  const y0 = await page.evaluate(() => window.scrollY);
  await wt.locator('> summary').click();
  const form = wt.locator('form[data-weigh-form="' + dogId + '"]');
  await expect(form).toBeVisible();
  await expect(page.locator('#wpanel form[data-weigh-form]')).toHaveCount(0);   // not the panel at the top
  expect(await page.evaluate(() => window.__stay)).toBe(1);                     // no reload
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y0)).toBeLessThan(200);   // no jump to the top

  await form.locator('input[name=kg]').fill('2.35');
  await form.getByRole('button', { name: 'Add weight' }).click();
  const card = page.locator('.dc[data-dog="' + dogId + '"]');   // the card is redrawn after the save
  await expect(card.locator('details.wtc [data-weigh-msg] [data-saved="good"]')).toBeVisible();
  await expect(card.locator('details.wtc')).toHaveAttribute('open', '');
  await expect(card.locator('details.wtc [data-k="weight"] b')).toHaveText('2.35 kg');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ action: 'weighing', fields: { subject_id: dogId, weight_kg: '2.35' } });
});

test('no chip recorded opens Edit with the microchip box ready', async ({ page }) => {
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');
  const card = page.locator('.dc').filter({ has: page.locator('[data-k="chip"] [data-focus="chip_number"]') }).first();
  await card.locator('[data-k="chip"] button').click();
  await expect(card.locator('[data-dog-edit-host] input[name="chip_number"]')).toBeFocused();
});
