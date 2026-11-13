// Breed Better on the dog card (owner's design, 13 Nov 2026): ONE line, folded by default: logo, verdict, Testing, "x of y"
// points and a chevron. It unfolds in place to the checks grouped by section, must pass first ("n of m met"), each points
// section as "x of y"; things to do first. Each line opens that dog's Score tab at that section.
// Invented animals and rows only (tests/fixtures/breed-better).
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
  test('one folded line: logo, verdict, Testing, x of y and a chevron; unfolds to must-pass and points groups; a line opens the Score tab', async ({ page }) => {
    await openDogs(page);
    const sec = card(page, 'Test Dog Two').locator('section.bb-sec');
    await expect(sec).toHaveCount(1);
    await expect(sec.locator('img.bb-logo')).toHaveAttribute('alt', 'Breed Better logo');
    await expect.poll(() => sec.locator('img.bb-logo').evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    await expect(sec.locator('.bb-sect')).toHaveText('Breed Better');
    const head = sec.locator('.bb-chip');
    await expect(head).toContainText('Fail');
    await expect(head).toContainText('Testing');
    await expect(head.locator('.bb-secpts')).toHaveText(/^\d+(\.\d)? of \d+$/);
    // folded: the checks are hidden until unfolded (there could be 40)
    await expect(sec.locator('details.bb-secd')).not.toHaveAttribute('open', '');
    await expect(sec.locator('.bb-gates').first()).toBeHidden();
    await expect(sec.locator('.bb-bar')).toHaveCount(0);
    await head.click();
    await expect(sec.locator('details.bb-secd')).toHaveAttribute('open', '');
    const groups = sec.locator('[data-bb-group]');
    await expect(groups.first()).toContainText(/Gates \d+ of 4 met/);
    const gates = groups.first().locator('.bb-gates li');
    await expect(gates).toHaveCount(4);
    await expect(gates.locator('.bb-gl')).toHaveText(['Hips pass', 'Elbows X-ray', 'Patella check', 'Fit to Breed']);
    await expect(groups.first().locator('li[data-gate="unverified"] .bb-gw').first()).toHaveText('Missing');
    for (const w of await gates.locator('.bb-gw').allTextContents()) expect(['Passed', 'Missing', 'Failed']).toContain(w);
    await expect(groups.nth(1)).toContainText(/Health \d+ of \d+/);
    const shots = process.env.DOGCARD_SHOTS;
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.addStyleTag({ content: '#nav{display:none!important}' }); await card(page, 'Test Dog Two').screenshot({ path: path.join(shots, 'after-desktop.png') }); }
    await gates.filter({ hasText: 'Fit to Breed' }).getByRole('button').click();
    await expect(page.locator('#main h2')).toContainText('Breed Better');
    await expect(page.locator('#bbRoot h3')).toContainText('Test Dog Two');
    await expect(page).toHaveURL(/#\/breed\/score\.sub-test-dog-2$/);
    await expect(page.locator('#bbRoot details.bb-band', { hasText: 'Gates' })).toHaveAttribute('open', '');
  });

  test('dog card, Breed Better, Open on Fit to Breed lands on add/edit, and Back returns to that dog @regression', async ({ page }) => {
    await openDogs(page);
    await card(page, 'Test Dog Two').locator('section.bb-sec .bb-chip').click();
    await card(page, 'Test Dog Two').getByRole('button', { name: 'Open in Breed Better', exact: true }).click();
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
    await expect(page).toHaveURL(/#\/breed\/score\.sub-test-dog-2$/);
    await expect(page.locator('#rows')).toHaveCount(0);
    await screen.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('[data-bb-edit-screen]')).toHaveCount(0);
    await expect(page.locator('#bbRoot h3')).toContainText('Test Dog Two');
    await expect(page.locator('#main h2')).toContainText('Breed Better');
    await expect(page).toHaveURL(/#\/breed\/score\.sub-test-dog-2$/);
  });

  test('phone: the section fits a 390px screen and the tap target is at least 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDogs(page);
    const sec = card(page, 'Test Dog One').locator('section.bb-sec');
    const b = await sec.boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(391);
    expect((await sec.locator('.bb-chip').boundingBox()).height).toBeGreaterThanOrEqual(44);
    const shots = process.env.DOGCARD_SHOTS;
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.addStyleTag({ content: '#nav{display:none!important}' }); await card(page, 'Test Dog One').screenshot({ path: path.join(shots, 'after-phone.png') }); }
  });
});
