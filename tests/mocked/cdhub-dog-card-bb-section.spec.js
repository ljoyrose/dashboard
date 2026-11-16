// Breed Better on the dog card (Lisa, 12 Nov 2026): a proper section headed by the Breed Better logo, not a small grey strip.
// Verdict and Testing badges, the score as a bar against the target, the must-pass checks one per line (Passed, Missing or
// Failed), and a tap through to the dog's Breed Better page. Invented animals and rows only (tests/fixtures/breed-better).
// DOGCARD_SHOTS=<folder> also saves desktop and 390px pictures of the section.
const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const BB = path.resolve(__dirname, '..', 'fixtures', 'breed-better');
const readBB = (f) => fs.readFileSync(path.join(BB, f), 'utf8');
// three more invented must-pass checks with no rule rows, so they read "Missing"
const EXTRA = ['c-elbow-gate,s-test,b-gate,elbow_gate,Elbows X-ray,BLD-health_screen,subject_id,test=elbows,grade,tested_on,latest,,,unknown,,invented',
  'c-pat-gate,s-test,b-gate,patella_gate,Patella check,BLD-health_screen,subject_id,test=patella,grade,tested_on,latest,,,unknown,,invented',
  'c-ftb-gate,s-test,b-gate,ftb_gate,Fit to Breed,BLD-fit_to_breed,subject_id,,result,assessed_on,latest,,,unknown,,invented'];
// one invented answer each, so the rules are complete; the test dogs have no such records, so these read Missing
const EXTRA_POINTS = ['px1,c-elbow-gate,in:0,,pass,', 'px2,c-pat-gate,in:0,,pass,', 'px3,c-ftb-gate,in:Fit,,pass,'];
function world() {
  const d = buildWorld();
  fs.readdirSync(BB).filter((f) => f.endsWith('.csv')).forEach((f, i) => {
    let text = readBB(f);
    if (f === 'BLD-score_criterion.csv') text = text.trimEnd() + '\n' + EXTRA.join('\n') + '\n';
    if (f === 'BLD-score_point.csv') text = text.trimEnd() + '\n' + EXTRA_POINTS.join('\n') + '\n';
    d.file('bb-' + i, f, text, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  });
  return d;
}
const test = base.extend({ world: async ({}, use) => use(world()) });
const card = (page, name) => page.locator('article.dc', { hasText: name });

async function openDogs(page) {
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');
  await expect(page.locator('#main')).toContainText('Test Dog One');
}

test.describe('CD Hub dog card: Breed Better section', () => {
  test('logo heading, verdict and Testing, score bar with the target, must-pass lines, and the tap through', async ({ page }) => {
    await openDogs(page);
    const sec = card(page, 'Test Dog Two').locator('section.bb-sec');
    await expect(sec).toHaveCount(1);
    await expect(sec.locator('img.bb-logo')).toHaveAttribute('alt', 'Breed Better logo');
    await expect.poll(() => sec.locator('img.bb-logo').evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    await expect(sec.locator('.bb-sect')).toHaveText('Breed Better');
    await expect(sec.locator('.bb-sechd')).toContainText('Fail');
    await expect(sec.locator('.bb-sechd')).toContainText('Testing');
    await expect(sec.locator('.bb-bar')).toHaveAttribute('aria-label', /^\d+ of \d+ points/);   // the score shows without a tap
    await expect(sec.locator('.bb-misscnt')).toHaveText('3 missing \u00b7 1 failed');
    await sec.locator('.bb-misshd').click();
    const gates = sec.locator('.bb-gates li');
    await expect(gates).toHaveCount(4);
    await expect(gates.locator('.bb-gl')).toHaveText(['Hips pass', 'Elbows X-ray', 'Patella check', 'Fit to Breed']);
    await expect(sec.locator('.bb-gates li[data-gate="unverified"] .bb-gw').first()).toHaveText('Missing');
    for (const w of await gates.locator('.bb-gw').allTextContents()) expect(['Passed', 'Missing', 'Failed']).toContain(w);
    // no grey strip: the old one-line chip text is gone
    await expect(card(page, 'Test Dog Two')).not.toContainText(/Unverified · 0 of/);
    const shots = process.env.DOGCARD_SHOTS;
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.addStyleTag({ content: '#nav{display:none!important}' }); await card(page, 'Test Dog Two').screenshot({ path: path.join(shots, 'after-desktop.png') }); }
    await sec.locator('.bb-sechd').click();
    await expect(page.locator('#main h2')).toContainText('Breed Better');
    await expect(page.locator('#bbRoot h3')).toContainText('Test Dog Two');
  });

  test('Back to the dog returns to the same card at the same place, by the button and by the browser Back, after Next and a tab', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await openDogs(page);
    const two = card(page, 'Test Dog Two');
    await two.locator('.bb-sechd').scrollIntoViewIfNeeded();
    const top = await two.evaluate((el) => el.getBoundingClientRect().top);
    await two.locator('.bb-sechd').click();
    await expect(page.locator('#bbRoot h3')).toContainText('Test Dog Two');
    const nextBtn = page.locator('.bb-nav [data-bb-open]').last();
    if (await nextBtn.isEnabled()) await nextBtn.click(); else await page.locator('.bb-nav [data-bb-open]').first().click();
    await expect(page.locator('#bbRoot h3')).not.toContainText('Test Dog Two');
    await page.locator('[data-bb-back]').click();   // to the Breed Better list and its tabs
    await page.locator('.bb-tabs [data-bb-tab]:not([aria-current])').last().click();
    await expect(page.getByRole('button', { name: 'Back to Test Dog Two' })).toBeVisible();
    await expect(page.locator('#bbRoot [data-hub-back]')).toHaveText('\u2190 Back to Test Dog Two');   // HubNav's own Back (NAV #610)
    await page.getByRole('button', { name: 'Back to Test Dog Two' }).click();
    await expect(two.locator('.bb-sechd')).toBeVisible();
    await expect.poll(() => two.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(Math.round(top));
    // the phone's Back does the same
    await two.locator('.bb-sechd').click();
    await expect(page.locator('#bbRoot h3')).toContainText('Test Dog Two');
    await page.goBack();
    await expect(two.locator('.bb-sechd')).toBeVisible();
    await expect.poll(() => two.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(Math.round(top));
    // opened from the menu, there is no Back to a dog
    await tabClick(page, '#nav button[data-go="breed"]');
    await expect(page.locator('#bbRoot').getByRole('button', { name: /Back to / })).toHaveCount(0);
  });

  test('the must-pass list is folded at first behind one line; a tap opens it, and open or folded is remembered', async ({ page }) => {
    await openDogs(page);
    const sec = () => card(page, 'Test Dog Two').locator('section.bb-sec');
    await expect(sec().locator('details.bb-miss')).not.toHaveAttribute('open', '');
    await expect(sec().locator('.bb-sechd')).toBeVisible();
    await expect(sec().locator('.bb-secpts')).toHaveText(/\d+ of \d+/);
    await expect(sec().locator('.bb-bar')).toBeVisible();
    await expect(sec().locator('.bb-gates')).toBeHidden();
    await sec().locator('.bb-misshd').click();
    await expect(sec().locator('.bb-gates')).toBeVisible();
    await page.reload();
    await expect(page.locator('#main')).toContainText('Test Dog One');
    await expect(sec().locator('.bb-gates')).toBeVisible();
    await expect(card(page, 'Test Dog One').locator('details.bb-miss')).not.toHaveAttribute('open', '');
    await sec().locator('.bb-misshd').click();
    await expect(sec().locator('.bb-gates')).toBeHidden();
    await page.reload();
    await expect(page.locator('#main')).toContainText('Test Dog One');
    await expect(sec().locator('.bb-gates')).toBeHidden();
  });

  test('dog card, Breed Better, Open on Fit to Breed lands on add/edit, and Back returns to that dog @regression', async ({ page }) => {
    await openDogs(page);
    await card(page, 'Test Dog Two').locator('section.bb-sec .bb-sechd').click();
    await expect(page.locator('#main h2')).toContainText('Breed Better');
    await expect(page.locator('#bbRoot h3')).toContainText('Test Dog Two');
    const band = page.locator('details.bb-band', { hasText: 'Fit to Breed' });
    await band.locator('summary').click();
    await band.locator('.bb-line', { hasText: 'Fit to Breed' }).getByRole('button', { name: 'Open' }).click();
    const screen = page.locator('[data-bb-edit-screen]');
    await expect(screen).toBeVisible();
    await expect(screen.locator('h3')).toHaveText('Fit to Breed');
    await expect(screen).toContainText('Add result');
    await expect(screen.locator('input[name="answer"]')).toBeVisible();
    await expect(screen.locator('input[name="on"]')).toHaveAttribute('type', 'date');
    await expect(page.locator('#main h2')).toContainText('Breed Better');
    await expect(page).toHaveURL(/#\/breed$/);
    await expect(page.locator('#rows')).toHaveCount(0);
    await screen.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('[data-bb-edit-screen]')).toHaveCount(0);
    await expect(page.locator('#bbRoot h3')).toContainText('Test Dog Two');
    await expect(page.locator('#main h2')).toContainText('Breed Better');
    await expect(page).toHaveURL(/#\/breed$/);
  });

  test('phone: the section fits a 360px screen and the tap target is at least 44px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await openDogs(page);
    const sec = card(page, 'Test Dog One').locator('section.bb-sec');
    const b = await sec.boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(361);
    expect((await sec.locator('.bb-sechd').boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect((await sec.locator('.bb-misshd').boundingBox()).height).toBeGreaterThanOrEqual(44);
    await sec.locator('.bb-misshd').click();
    // nothing in the section overlaps: each must-pass line sits inside the card, word clear of the edge
    for (const li of await sec.locator('.bb-gates li').all()) {
      const lb = await li.boundingBox(), wb = await li.locator('.bb-gw').boundingBox();
      expect(lb.x + lb.width).toBeLessThanOrEqual(b.x + b.width + 1);
      expect(wb.x + wb.width).toBeLessThanOrEqual(lb.x + lb.width + 1);
    }
    const shots = process.env.DOGCARD_SHOTS;
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.addStyleTag({ content: '#nav{display:none!important}' }); await card(page, 'Test Dog One').screenshot({ path: path.join(shots, 'after-phone.png') }); }
  });
});
