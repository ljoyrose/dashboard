// CD Hub: small controls that used to do nothing when tapped (found by the click-crawl, 13 Nov 2026).
// Invented sample rows only. Nothing is saved anywhere.
const { test, expect } = require('../support/test');
const { tabClick } = require('../support/tabs');

const signIn = async (page) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const open = async (page, id) => {
  await tabClick(page, `#nav button[data-go="${id}"]`);
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};

test.describe('CD Hub: every small control answers a tap', () => {
  test('an (i) says its words when tapped or pressed, and puts them away on the second tap', async ({ page }) => {
    await signIn(page);
    await open(page, 'dogs');
    await page.locator('[data-fpanel="fp-dogs"]').click();
    const i = page.locator('#fp-dogs .info');
    await expect(i).toHaveAttribute('role', 'button');
    await expect(i).toHaveAttribute('aria-expanded', 'false');
    await i.click();
    const note = page.locator('#fp-dogs .infonote');
    await expect(note).toBeVisible();
    await expect(note).toHaveText('Tap a status to filter, tap All to clear. Collected and deceased are hidden until you tap them.');
    await expect(i).toHaveAttribute('aria-expanded', 'true');
    await i.click();
    await expect(note).toHaveCount(0);
    await i.focus();
    await page.keyboard.press('Enter');
    await expect(note).toBeVisible();
    await page.keyboard.press(' ');
    await expect(note).toHaveCount(0);

    // the (i) the page makes from a help list answers the same way, and the tap stays on this screen
    await page.evaluate(() => { document.getElementById('main').insertAdjacentHTML('afterbegin', '<div data-open-row id="tapRow"><a class="house-open" href="#/work">Sample row</a><ul class="notes"><li>Sample help words.</li></ul></div>'); });
    const made = page.locator('#tapRow .info');
    await expect(made).toHaveAttribute('role', 'button');
    await made.click();
    await expect(page.locator('#tapRow .infonote')).toHaveText('Sample help words.');
    await expect(page).toHaveURL(/#\/dogs$/);   // the row's own link was not pressed
  });

  test('Clear filters is off until there is something to clear, on Dogs and on SOPs', async ({ page }) => {
    await signIn(page);
    await open(page, 'dogs');
    await page.locator('[data-fpanel="fp-dogs"]').click();
    const clear = page.locator('#clr');
    await expect(clear).toBeDisabled();
    await page.locator('#fs').selectOption('Female');
    await expect(clear).toBeEnabled();
    await clear.click();
    await expect(page.locator('#fs')).toHaveValue('');
    await expect(clear).toBeDisabled();
    await page.locator('#q').fill('Test');
    await expect(clear).toBeEnabled();
    await clear.click();
    await expect(page.locator('#q')).toHaveValue('');
    await expect(clear).toBeDisabled();
    await page.locator('.sfb[data-code="CL"]').click();   // a status chip counts as a filter
    await expect(clear).toBeEnabled();
    await clear.click();
    await expect(clear).toBeDisabled();

    await open(page, 'sops');
    await page.locator('[data-fpanel="fp-sops"]').click();
    const sopClear = page.locator('#sopclr');
    await expect(sopClear).toBeDisabled();
    await page.locator('#sopq').fill('clean');
    await expect(sopClear).toBeEnabled();
    await sopClear.click();
    await expect(page.locator('#sopq')).toHaveValue('');
    await expect(sopClear).toBeDisabled();
  });

  test('a screen that is switched off is not offered: no button, link or Next leads to it', async ({ page }) => {
    await signIn(page);
    await open(page, 'today');
    // Switch Litters off the way a hide does it (the page function stays; the id leaves the wired list).
    const wired = await page.evaluate(() => !!PAGES.litters);
    await page.evaluate(() => { delete PAGES.litters; go('today', false); });
    await expect(page.locator('#main [data-go="litters"]')).toHaveCount(0);
    await page.evaluate(() => go('dogs', false));
    await expect(page.locator('#next [data-go="litters"]')).toHaveCount(0);
    const line = page.locator('.dc[data-dog="sub-test-dog-1"] .litc');
    await expect(line).toContainText('1 litter');
    await expect(line.locator('a')).toHaveCount(0);
    await expect(page.locator('#next button')).not.toHaveCount(0);
    for (const b of await page.locator('#next [data-go]').all()) expect(await page.evaluate((id) => !!PAGES[id], await b.getAttribute('data-go'))).toBe(true);
    test.info().annotations.push({ type: 'note', description: wired ? 'Litters is still wired on this branch (PR 472 not merged): the test switched it off itself' : 'Litters is already switched off' });
  });

  test('a rule with no start date says so in plain words (no column name on screen)', async ({ page }) => {
    await signIn(page);
    await page.evaluate(() => { T['BLD-declaration.csv'] = [{ id: 'd1', declaration_key: 'sample.rule', version: '1', effective_from: '', effective_to: '' }]; CD._built = (CD._built || 0) + 1; CD._needs = null; go('compliance', false); });
    await expect(page.locator('#main')).toContainText('sample.rule v1 has no start date');
    await expect(page.locator('#main')).not.toContainText('effective_from');
  });
});
