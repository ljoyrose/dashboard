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
    await expect(sec.locator('.bb-chip')).toContainText('Fail');
    await expect(sec.locator('.bb-chip')).toContainText('Testing');
    await expect(sec.locator('.bb-bar')).toHaveAttribute('aria-label', /^\d+ of \d+ points/);
    const gates = sec.locator('.bb-gates li');
    await expect(gates).toHaveCount(4);
    await expect(gates.locator('.bb-gl')).toHaveText(['Hips pass', 'Elbows X-ray', 'Patella check', 'Fit to Breed']);
    await expect(sec.locator('.bb-gates li[data-gate="unverified"] .bb-gw').first()).toHaveText('Missing');
    for (const w of await gates.locator('.bb-gw').allTextContents()) expect(['Passed', 'Missing', 'Failed']).toContain(w);
    // no grey strip: the old one-line chip text is gone
    await expect(card(page, 'Test Dog Two')).not.toContainText(/Unverified · 0 of/);
    const shots = process.env.DOGCARD_SHOTS;
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.addStyleTag({ content: '#nav{display:none!important}' }); await card(page, 'Test Dog Two').screenshot({ path: path.join(shots, 'after-desktop.png') }); }
    await sec.locator('.bb-chip').click();
    await expect(page.locator('#main h2')).toContainText('Breed Better');
    await expect(page.locator('#bbRoot h3')).toContainText('Test Dog Two');
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
