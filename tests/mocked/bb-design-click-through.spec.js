// Breed Better built to the owner's design (13 Nov 2026): every Breed Better button and tab, collapsed and expanded, at 360px
// and on a desktop. Each click checks where it landed: no dead buttons, no silent loops, no sideways scroll at 360px.
// Invented animals and rows only: the hub's own test dogs (sub-test-dog-1, sub-test-dog-2, sub-test-pup-1) and the rows below.
// BB_SHOTS=<folder> also saves a picture of each screen (built screens only, invented data).
const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const FTB_HEAD = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'breed-better', 'BLD-fit_to_breed.csv'), 'utf8').trim();
const csv = (rows) => rows.join('\n') + '\n';
const ROWS = {
  'BLD-score_scheme.csv': csv(['id,name,species_id,breed,version,effective_from,status,target_points,target_is,source',
    's-look,Invented look scheme,dog,,1,2026-01-01,active,70,percent,invented']),
  'BLD-score_band.csv': csv(['id,scheme_id,key,label,colour,sort_order,kind,icon_key,line_colour,icon_light,icon_dark',
    'b-a,s-look,a,Section A,purple,1,points,target,#d9d4e0,#625a6d,#b0a8bb',
    'b-g,s-look,g,Must pass,red,2,gate,star,#ee4035,#ca362d,#f0625a',
    'b-h,s-look,h,Section B,orange,3,points,heart,#f37736,#ae5526,#f37736',
    'b-f,s-look,f,Section C,yellow,4,points,stethoscope,#e7dc44,#757022,#e7dc44',
    'b-t,s-look,t,Section D,green,5,points,smile,#7bc043,#4e7a2a,#7bc043',
    'b-r,s-look,r,Section E,blue,6,points,people,#0392cf,#0274a5,#3cb0e6',
    'b-s,s-look,s,Status,black,7,status,,,,']),
  'BLD-score_criterion.csv': csv(['id,scheme_id,band_id,key,label,evidence_source,subject_field,evidence_match,answer_field,date_field,reads,applies_to,valid_months,due_soon_days,lapsed_affects_verdict,when_missing,guidance,proof_label,authority',
    'c-look,s-look,b-a,look,Looks answer,judged,,,,,latest,,,,,unknown,,,invented',
    'c-hips-g,s-look,b-g,hips_g,Hips X-ray,BLD-health_screen,subject_id,test=hips,grade,tested_on,latest,,24,60,FALSE,unknown,,hip score certificate,invented',
    'c-elb-g,s-look,b-g,elb_g,Elbows X-ray,BLD-health_screen,subject_id,test=elbows,grade,tested_on,latest,,24,60,FALSE,unknown,,elbow score sheet,invented',
    'c-pat-g,s-look,b-g,pat_g,Patella check,BLD-health_screen,subject_id,test=patella,grade,tested_on,latest,,12,60,FALSE,unknown,,patella grade record,invented',
    'c-ftb-g,s-look,b-g,ftb_g,Fit to Breed,BLD-fit_to_breed,subject_id,,outcome,assessed_on,latest,,12,60,FALSE,unknown,,signed Fit to Breed form,invented',
    'c-eyes,s-look,b-h,eyes,Eyes,BLD-health_screen,subject_id,test=eyes,grade,tested_on,latest,,12,60,FALSE,unknown,,,invented',
    'c-hips-p,s-look,b-h,hips_p,Hips grade,BLD-health_screen,subject_id,test=hips,grade,tested_on,latest,,,,,unknown,,,invented',
    'c-ftb-p,s-look,b-f,ftb_p,Fit to Breed points,BLD-fit_to_breed,subject_id,,outcome,assessed_on,latest,,,,,unknown,,,invented',
    'c-temp,s-look,b-t,temp,Temperament answer,judged,,,,,latest,,,,,unknown,,,invented',
    'c-lit,s-look,b-r,litters,Litters on file,BLD-litter,dam_subject_id,,,born_on,count,sex=F,,,,unknown,,,invented',
    'c-status,s-look,b-s,status,Status,BLD-subject_status,subject_id,,state,,latest,,,,,unknown,,,invented']),
  'BLD-score_point.csv': csv(['id,criterion_id,answer_match,points,gate_outcome,note',
    'p1,c-look,is:Yes,5,,', 'p2,c-look,any,0,,',
    'p3,c-hips-g,in:Excellent|Good,,pass,', 'p4,c-hips-g,any,,fail,',
    'p5,c-elb-g,in:0,,pass,', 'p6,c-elb-g,any,,fail,',
    'p7,c-pat-g,in:0,,pass,', 'p8,c-pat-g,any,,fail,',
    'p9,c-ftb-g,is:fit,,pass,', 'p10,c-ftb-g,any,,fail,',
    'p11,c-eyes,is:Unaffected,10,,', 'p12,c-eyes,any,0,,',
    'p13,c-hips-p,is:Excellent,15,,', 'p14,c-hips-p,is:Good,10,,', 'p15,c-hips-p,any,0,,',
    'p16,c-ftb-p,is:fit,25,,', 'p17,c-ftb-p,any,0,,',
    'p18,c-temp,is:Calm,15,,', 'p19,c-temp,any,5,,',
    'p20,c-lit,range:1-6,15,,', 'p21,c-lit,any,0,,']),
  'BLD-score_enrolment.csv': csv(['id,tenant_id,scheme_id,subject_id,valid_from,is_active,source',
    'e1,t-test,s-look,sub-test-dog-1,2026-01-01,TRUE,invented', 'e2,t-test,s-look,sub-test-dog-2,2026-01-01,TRUE,invented', 'e3,t-test,s-look,sub-test-pup-1,2026-01-01,TRUE,invented']),
  'BLD-score_judgement.csv': csv(['id,tenant_id,subject_id,criterion_id,answer,judged_on,judged_by,note',
    'j1,t-test,sub-test-dog-1,look,Yes,2026-09-01,Owner,', 'j2,t-test,sub-test-dog-1,temp,Calm,2026-09-01,Owner,']),
  'BLD-health_screen.csv': csv(['id,subject_id,test,grade,tested_on',
    'h1,sub-test-dog-1,hips,Good,2025-06-01', 'h2,sub-test-dog-1,elbows,0,2025-06-01', 'h3,sub-test-dog-1,patella,0,2025-12-02', 'h4,sub-test-dog-1,eyes,Unaffected,2025-11-20',
    'h5,sub-test-dog-2,hips,Poor,2025-06-01', 'h6,sub-test-dog-2,eyes,Unaffected,2025-11-07', 'h7,sub-test-pup-1,elbows,0,2026-10-02']),
  'BLD-fit_to_breed.csv': FTB_HEAD + '\nftb-1,t-test,sub-test-dog-1,2026-10-03,fit,,,,,,,,,,,,,,2027-10-03\n',
  'BLD-dna_marker.csv': csv(['code,name,group_label,inheritance_mode,copies_0,copies_1,copies_2,breeding_rule,source,scored',
    'TESTR,Recessive example,Group A,autosomal recessive,clear,carrier,affected,Never carrier x carrier.,example source,false']),
  'BLD-dna_result.csv': csv(['id,tenant_id,subject_id,marker_code,copies,genotype,interpretation,lab,tested_on', 'd1,t-test,sub-test-dog-1,TESTR,1,N/r,carrier,Lab A,2026-03-02']),
  'BLD-grade_band.csv': csv(['id,species_id,test,test_label,scale,grade_match,level,label,sort_order,source',
    'g1,dog,hips,Hips,invented scale,in:Excellent|Good,good,Excellent or Good,1,invented', 'g2,dog,hips,Hips,,is:Fair,watch,Fair,2,invented', 'g3,dog,hips,Hips,,in:Borderline|Poor,poor,Borderline or Poor,3,invented'])
};
function world() {
  const d = buildWorld();
  Object.keys(ROWS).forEach((f, i) => d.file('bbd-' + i, f, ROWS[f], { parents: [IDS.bld], driveId: 'drv-alpha1' }));
  return d;
}
const test = base.extend({ world: async ({}, use) => use(world()) });
const SHOTS = process.env.BB_SHOTS;
async function shot(page, name, w) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, name + '-' + w + '.png'), fullPage: true });
}

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
async function openBB(page, hash) {
  await page.clock.setFixedTime(new Date('2026-11-13T10:00:00Z'));
  await page.goto('cdhub/' + (hash || ''));
  await signIn(page);
  if (!hash) await tabClick(page, '#nav button[data-go="breed"]');
  await expect(page.locator('#main h2')).toContainText('Breed Better');
}
const root = (page) => page.locator('#bbRoot');
const tab = (page, k) => page.locator('#bbRoot nav.bb-tabs [data-bb-tab="' + k + '"]');
async function noSideways(page) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(o, 'no sideways scroll').toBeLessThanOrEqual(0);
}

for (const [w, h] of [[360, 800], [1280, 900]]) {
  test.describe('Breed Better to the owner\'s design at ' + w + 'px', () => {
    test.use({ viewport: { width: w, height: h } });

    test('five tabs at the bottom, above the house bar, in order; each lands and has its own address; they stay on a dog page', async ({ page }) => {
      await openBB(page);
      const bar = page.locator('#bbRoot nav.bb-tabs');
      await expect(bar.locator('.bb-tab .bb-tabw')).toHaveText(['Score', 'Evidence', 'Dogs', 'Calendar', 'More']);
      await expect(tab(page, 'dogs')).toHaveAttribute('aria-current', 'page');
      const bb = await bar.boundingBox(), house = await page.locator('nav.house-tabs').boundingBox();
      expect(bb.y + bb.height).toBeLessThanOrEqual(house.y + 1);
      expect(bb.y + bb.height).toBeGreaterThan(house.y - 2);
      await noSideways(page);
      await shot(page, 'list', w);
      const lands = [['cal', /#\/breed\/calendar$/, 'Calendar'], ['more', /#\/breed\/more$/, 'More'], ['evidence', /#\/breed\/evidence\.sub-test-dog-1$/, 'Evidence'],
        ['score', /#\/breed\/score\.sub-test-dog-1$/, 'Breed Better verdict'], ['dogs', /#\/breed\/dogs$/, 'All dogs']];
      for (const [k, url, text] of lands) {
        await tab(page, k).click();
        await expect(page).toHaveURL(url);
        await expect(root(page)).toContainText(text);
        await expect(tab(page, k)).toHaveAttribute('aria-current', 'page');
        await expect(page.locator('#bbRoot nav.bb-tabs .bb-tab')).toHaveCount(5);
        await noSideways(page);
      }
      // Back goes to the tab before; a reload keeps the tab
      await page.goBack();
      await expect(page).toHaveURL(/#\/breed\/score\.sub-test-dog-1$/);
      await tab(page, 'cal').click();
      await page.reload();
      if (await page.locator('#signinbtn').count()) await signIn(page);
      await expect(page).toHaveURL(/#\/breed\/calendar$/);
      await expect(root(page).locator('h3')).toHaveText('Calendar');
    });

    test('the last row and controls clear both bars; the house bar is unchanged and has no Breed Better item', async ({ page }) => {
      await openBB(page);
      await expect(page.locator('nav.house-tabs > [data-go="breed"], nav.house-tabs > a[data-nav="breed"]')).toHaveCount(0);
      await expect(page.locator('nav.house-tabs')).not.toContainText('Calendar');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const last = await page.locator('#bbRoot .bb-row').last().boundingBox();
      const bar = await page.locator('#bbRoot nav.bb-tabs').boundingBox();
      expect(last.y + last.height).toBeLessThanOrEqual(bar.y + 1);
    });

    test('Score tab with no dog chosen opens the first in the list; then the last dog viewed; prev and next walk the list', async ({ page }) => {
      await openBB(page);
      await expect(page.locator('#bbRoot .bb-row .bb-name')).toHaveText(['Test Dog One', 'Test Pup One', 'Test Dog Two']);
      await tab(page, 'score').click();
      await expect(page.locator('#bbRoot h3.bb-dname')).toHaveText('Test Dog One');
      await expect(root(page)).toContainText('1 of 3');
      await page.getByRole('button', { name: 'Next: Test Pup One' }).click();
      await expect(page.locator('#bbRoot h3.bb-dname')).toHaveText('Test Pup One');
      await expect(page).toHaveURL(/#\/breed\/score\.sub-test-pup-1$/);
      await page.getByRole('button', { name: 'Previous: Test Dog One' }).click();
      await expect(page.locator('#bbRoot h3.bb-dname')).toHaveText('Test Dog One');
      await page.locator('#bbRoot [data-bb-back]').click();
      await expect(page).toHaveURL(/#\/breed\/dogs$/);
      await page.locator('#bbRoot [data-bb-open="sub-test-dog-2"]').click();
      await expect(page.locator('#bbRoot h3.bb-dname')).toHaveText('Test Dog Two');
      await tab(page, 'cal').click();
      await tab(page, 'score').click();
      await expect(page.locator('#bbRoot h3.bb-dname')).toHaveText('Test Dog Two');
    });

    test('every verdict filter, the sex filter, the search and all seven sorts', async ({ page }) => {
      await openBB(page);
      const rows = page.locator('#bbRoot .bb-row');
      const counts = { '': 3, pass: 1, below_target: 0, unverified: 1, fail: 1 };
      for (const k of Object.keys(counts)) {
        await page.locator('#bbRoot [data-bb-filter="' + k + '"]').click();
        await expect(page.locator('#bbRoot [data-bb-filter="' + k + '"]')).toHaveAttribute('aria-pressed', 'true');
        await expect(rows).toHaveCount(counts[k]);
      }
      await page.locator('#bbRoot [data-bb-filter=""]').click();
      for (const [k, n] of [['F', 2], ['M', 1], ['', 3]]) {
        await page.locator('#bbRoot [data-bb-sex="' + k + '"]').click();
        await expect(rows).toHaveCount(n);
      }
      await page.locator('#bbSearch').fill('pup');
      await expect(rows).toHaveCount(1);
      await expect(root(page)).toContainText('1 of 3 shown');
      await page.locator('#bbSearch').fill('');
      const firsts = { verdict: 'Test Dog One', high: 'Test Dog One', low: 'Test Pup One', name: 'Test Dog One', oldest: 'Test Dog Two', youngest: 'Test Pup One', attention: 'Test Dog Two' };
      for (const k of Object.keys(firsts)) {
        await page.locator('#bbSort').selectOption(k);
        await expect(rows.first().locator('.bb-name')).toHaveText(firsts[k]);
      }
    });

    test('the list row: name 16px, score 18px, verdict word, one section icon per section in its row colour, grey when nothing scored', async ({ page }) => {
      await openBB(page);
      const row = page.locator('#bbRoot .bb-row').first();
      expect(await row.locator('.bb-name').evaluate((e) => getComputedStyle(e).fontSize)).toBe('16px');
      expect(await row.locator('.bb-big').evaluate((e) => getComputedStyle(e).fontSize)).toBe('18px');
      await expect(row.locator('.bb-big')).toHaveText('80');
      await expect(row).toContainText('80 of 85');
      await expect(row.locator('.bb-vw')).toHaveText('Pass');
      const icons = row.locator('.bb-sic');
      await expect(icons).toHaveCount(6);
      await expect(icons.nth(1)).toHaveAttribute('aria-label', /^Must pass: 4 of 4 met/);
      expect(await icons.nth(1).evaluate((e) => getComputedStyle(e).color)).toBe('rgb(202, 54, 45)');
      // rest: no fill; hover: the pale grey; no outline
      expect(await icons.nth(1).evaluate((e) => getComputedStyle(e).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      await icons.nth(1).hover();
      const hov = await page.evaluate(() => { const p = document.createElement('i'); p.style.background = 'var(--hov)'; document.body.appendChild(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; });
      await expect.poll(() => icons.nth(1).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(hov);
      const off = page.locator('#bbRoot .bb-row').filter({ hasText: 'Test Dog Two' }).locator('.bb-sic.bb-off');
      expect(await off.count()).toBeGreaterThan(0);
      const muted = await page.evaluate(() => { const p = document.createElement('i'); p.style.color = 'var(--muted)'; document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return c; });
      expect(await off.first().evaluate((e) => getComputedStyle(e).color)).toBe(muted);
    });

    test('each section icon opens that dog\'s Score tab with that section open', async ({ page }) => {
      await openBB(page);
      const n = await page.locator('#bbRoot .bb-row').first().locator('.bb-sic').count();
      for (let i = 0; i < n; i++) {
        const ic = page.locator('#bbRoot .bb-row').first().locator('.bb-sic').nth(i);
        const band = await ic.getAttribute('data-bb-band-go');
        await ic.click();
        await expect(page).toHaveURL(/#\/breed\/score\.sub-test-dog-1$/);
        await expect(page.locator('#bbRoot details.bb-band[data-bb-band="' + band + '"]')).toHaveAttribute('open', '');
        await tab(page, 'dogs').click();
      }
    });

    test('the dog page: verdict box with the worked-out percent line, Scored on, section counts, folds and Show done, To prove, Open', async ({ page }) => {
      await openBB(page, '#/breed/score.sub-test-dog-1');
      const box = page.locator('#bbRoot .bb-vbox');
      await expect(box).toContainText('Pass');
      await expect(box).toContainText('of 85 points');
      await expect(box.locator('.bb-pct')).toHaveText('Target 70%. This dog ' + Math.round(100 * 80 / 85) + '%.');
      await expect(box).toContainText('80 earned');
      await expect(box).toContainText('0 to prove');
      await expect(box).toContainText('5 lost');
      await expect(box).toContainText('Scored on 13 Nov 2026');
      const must = page.locator('#bbRoot details.bb-band[data-bb-band="b-g"]');
      await expect(must.locator(':scope > summary')).toContainText('Must pass');
      await expect(must.locator(':scope > summary .cnt')).toHaveText('4 of 4 met');
      await expect(page.locator('#bbRoot details.bb-band[data-bb-band="b-h"] > summary .cnt')).toHaveText('20 of 25');
      await expect(page.locator('#bbRoot details.bb-band[data-bb-band="b-s"] > summary .bb-tag')).toHaveCount(1);
      // Information fold
      await page.locator('#bbRoot details.bb-infobox summary').click();
      await expect(page.locator('#bbRoot details.bb-infobox')).toHaveAttribute('open', '');
      // every section folds open and shut
      for (const s of await page.locator('#bbRoot details.bb-band').all()) {
        await s.locator(':scope > summary').click();
        await expect(s).toHaveAttribute('open', '');
      }
      // the due line comes first; done lines sit under Show done
      await expect(must.locator('.bb-line').first()).toContainText('Patella check');
      await expect(must.locator('.bb-line').first()).toContainText('Due 2 Dec 2026');
      const done = must.locator('details.bb-done');
      await expect(done.locator('summary')).toContainText('Show done');
      await done.locator('summary').click();
      await expect(done.locator('.bb-line', { hasText: 'Hips X-ray' })).toBeVisible();
      await expect(page.locator('#bbRoot details.bb-band[data-bb-band="b-a"]')).toContainText('judged by Owner');
      await shot(page, 'score', w);
      // the DNA panel fold
      await page.locator('#bbRoot details.bb-dna summary').click();
      await expect(page.locator('#bbRoot details.bb-dna')).toContainText('DNA panel');
      await expect(page.locator('#bbRoot details.bb-dna')).toContainText('1 Carrier');
      await expect(page.locator('#bbRoot details.bb-dna .bb-gband[data-level="good"]')).toHaveText('Good');
      // Open on a line is the add/edit screen, and Back returns to the dog
      await done.locator('.bb-line', { hasText: 'Hips X-ray' }).getByRole('button', { name: 'Open' }).click();
      await expect(page.locator('[data-bb-edit-screen]')).toBeVisible();
      await expect(page.locator('#bbRoot nav.bb-tabs .bb-tab')).toHaveCount(5);
      await page.locator('[data-bb-edit-screen]').getByRole('button', { name: 'Back' }).click();
      await expect(page.locator('#bbRoot h3.bb-dname')).toHaveText('Test Dog One');
      await noSideways(page);
    });

    test('an Unverified check shows what is still to prove; Unverified, never Unproven', async ({ page }) => {
      await openBB(page, '#/breed/score.sub-test-pup-1');
      const must = page.locator('#bbRoot details.bb-band[data-bb-band="b-g"]');
      await must.locator(':scope > summary').click();
      await expect(must.locator(':scope > summary .cnt')).toHaveText('1 of 4 met');
      await expect(must.locator('.bb-line', { hasText: 'Hips X-ray' })).toContainText('Unverified');
      await expect(must.locator('.bb-line', { hasText: 'Hips X-ray' }).locator('.bb-prove')).toHaveText('To prove: hip score certificate');
      await expect(must.locator('.bb-line', { hasText: 'Fit to Breed' }).locator('.bb-prove')).toHaveText('To prove: signed Fit to Breed form');
      await expect(page.locator('#main')).not.toContainText(/unproven/i);
      await expect(page.locator('#main')).not.toContainText(/\b\d{4}-\d{2}-\d{2}\b/);
    });

    test('Calendar: n due in the next 30 days, Due / Done / All with counts, pager, a tapped day and clearing it, a row opens that check', async ({ page }) => {
      await openBB(page, '#/breed/calendar');
      await expect(root(page).locator('h3')).toHaveText('Calendar');
      await expect(root(page)).toContainText('2 due in the next 30 days');
      const f = (k) => page.locator('#bbRoot [data-bb-cal="' + k + '"]');
      await expect(f('due')).toHaveAttribute('aria-pressed', 'true');
      const num = async (k) => Number((await f(k).locator('.cnt').textContent()).trim());
      expect(await num('all')).toBe(await num('due') + await num('done'));
      await expect(root(page)).toContainText('November 2026');
      await expect(page.locator('#bbRoot .bb-today')).toHaveText(/^13/);
      await expect(page.locator('#bbRoot .bb-callist .bb-calrow')).toHaveCount(2);
      await expect(page.locator('#bbRoot .bb-callist .bb-calrow').first()).toContainText('Test Dog Two, Eyes');
      await expect(page.locator('#bbRoot .bb-callist .bb-calrow').first()).toContainText('Overdue');
      await expect(page.locator('#bbRoot .bb-callist .bb-calrow').nth(1)).toContainText('20 Nov 2026');
      await shot(page, 'calendar', w);
      // a day with nothing is not a button
      await expect(page.locator('#bbRoot button.bb-day', { hasText: /^8$/ })).toHaveCount(0);
      await page.locator('#bbRoot [data-bb-day="2026-11-07"]').click();
      await expect(root(page)).toContainText('Showing 7 Nov 2026');
      await expect(page.locator('#bbRoot .bb-callist .bb-calrow')).toHaveCount(1);
      await page.locator('#bbRoot [data-bb-day="2026-11-07"]').click();
      await expect(page.locator('#bbRoot .bb-callist .bb-calrow')).toHaveCount(2);
      await page.locator('#bbRoot [data-bb-day="2026-11-20"]').click();
      await page.getByRole('button', { name: 'Show the whole month' }).click();
      await expect(page.locator('#bbRoot .bb-callist .bb-calrow')).toHaveCount(2);
      for (const k of ['done', 'all', 'due']) { await f(k).click(); await expect(f(k)).toHaveAttribute('aria-pressed', 'true'); }
      await page.getByRole('button', { name: 'Next month' }).click();
      await expect(root(page)).toContainText('December 2026');
      await expect(page.locator('#bbRoot .bb-callist .bb-calrow', { hasText: 'Patella check' })).toContainText('2 Dec 2026');
      await page.getByRole('button', { name: 'Previous month' }).click();
      await page.getByRole('button', { name: 'Previous month' }).click();
      await expect(root(page)).toContainText('October 2026');
      await page.getByRole('button', { name: 'Next month' }).click();
      // the undated: never recorded at all
      await expect(root(page)).toContainText('No record yet');
      await page.locator('#bbRoot details.bb-calnone > summary').click();
      await expect(page.locator('#bbRoot details.bb-calnone .bb-calrow').first()).toBeVisible();
      await page.locator('#bbRoot .bb-calrow', { hasText: 'Test Dog Two, Eyes' }).click();
      await expect(page).toHaveURL(/#\/breed\/score\.sub-test-dog-2$/);
      await expect(page.locator('#bbRoot details.bb-band[data-bb-band="b-h"]')).toHaveAttribute('open', '');
      await noSideways(page);
    });

    test('Evidence: every dated record for the dog, newest first, filters by kind and by check with counts, used-by', async ({ page }) => {
      await openBB(page, '#/breed/evidence.sub-test-dog-1');
      await expect(root(page)).toContainText('Evidence');
      const items = page.locator('#bbRoot .bb-ev');
      const all = await items.count();
      expect(all).toBeGreaterThan(5);
      await expect(page.locator('#bbRoot [data-bb-evkind=""] .cnt')).toHaveText(String(all));
      await expect(items.first()).toContainText('3 Oct 2026');
      await expect(page.locator('#bbRoot .bb-ev', { hasText: 'Good' })).toContainText('Used by: Hips X-ray, Hips grade');
      await shot(page, 'evidence', w);
      for (const b of await page.locator('#bbRoot [data-bb-evkind]').all()) {
        const n = Number((await b.locator('.cnt').textContent()).trim());
        const k = await b.getAttribute('data-bb-evkind');
        await b.click();
        await expect(page.locator('#bbRoot [data-bb-evkind="' + k + '"]')).toHaveAttribute('aria-pressed', 'true');
        await expect(items).toHaveCount(n);
      }
      await page.locator('#bbRoot [data-bb-evkind=""]').click();
      await page.locator('#bbRoot [data-bb-evcheck]').selectOption({ label: 'Hips grade' });
      await expect(items).toHaveCount(1);
      await expect(items.first()).toContainText('Good');
      await page.locator('#bbRoot [data-bb-evcheck]').selectOption('');
      await expect(items).toHaveCount(all);
      await expect(root(page)).not.toContainText(/Take or add proof|Upload/i);
    });

    test('More: My system, Archive, History, DNA panel and Who sees what each open and come back', async ({ page }) => {
      await openBB(page, '#/breed/more');
      await expect(page.locator('#bbRoot .bb-more .bb-name')).toHaveText(['My system', 'Archive', 'History', 'DNA panel', 'Who sees what']);
      await shot(page, 'more', w);
      const go = async (label, url, text) => {
        await page.locator('#bbRoot .bb-more', { hasText: label }).click();
        await expect(page).toHaveURL(url);
        await expect(root(page)).toContainText(text);
        await expect(tab(page, 'more')).toHaveAttribute('aria-current', 'page');
      };
      await go('My system', /#\/breed\/system$/, 'Read only. A star means must pass.');
      await page.locator('#bbRoot details.bb-band').first().locator('summary').click();
      await page.locator('#bbRoot [data-bb-tab="more"]').first().click();
      await go('Archive', /#\/breed\/archive$/, 'Animals whose scoring has ended');
      await page.locator('#bbRoot [data-bb-tab="more"]').first().click();
      await go('History', /#\/breed\/history\.sub-test-dog-1$/, 'Nothing is stored or changed');
      await expect(page.locator('#bbRoot .bb-hist').first()).toContainText('3 Oct 2026');
      await expect(page.locator('#bbRoot .bb-hist').first().locator('.bb-v')).toHaveText('Pass');
      await shot(page, 'history', w);
      await page.getByRole('button', { name: 'Next: Test Pup One' }).click();
      await expect(page).toHaveURL(/#\/breed\/history\.sub-test-pup-1$/);
      await page.locator('#bbRoot [data-bb-tab="more"]').first().click();
      await go('DNA panel', /#\/breed\/dna$/, 'Grade to colour');
      await expect(page.locator('#bbRoot .bb-gradebands .bb-gband')).toHaveText(['Excellent or Good', 'Fair', 'Borderline or Poor']);
      await page.locator('#bbRoot [data-bb-calc="sire:1"]').click();
      await page.locator('#bbRoot [data-bb-calc="dam:1"]').click();
      await expect(page.locator('#bbRoot .bb-calcout')).toContainText('25%');
      await page.locator('#bbRoot .bb-setup details summary').first().click();
      await expect(page.locator('#bbRoot .bb-setup')).toContainText('Never carrier x carrier.');
      await shot(page, 'dna', w);
      await page.locator('#bbRoot [data-bb-tab="more"]').first().click();
      await go('Who sees what', /#\/breed\/viewers$/, 'placeholder set');
      await expect(page.locator('#bbRoot [data-bb-viewer="inspector"] li[data-on="true"]', { hasText: 'Pass, Unverified or Fail' })).toHaveCount(1);
      for (const t of ['Points', 'The target', 'Ranking (best to worst)']) {
        await expect(page.locator('#bbRoot li[data-on="true"]', { hasText: t })).toHaveCount(0);
      }
      await expect(root(page).locator('input, select, textarea, form')).toHaveCount(0);
      await shot(page, 'viewers', w);
    });

    test('the dog card: one folded line, unfolds to grouped checks, each line opens the Score tab at that section', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-11-13T10:00:00Z'));
      await page.goto('cdhub/');
      await signIn(page);
      await tabClick(page, '#nav button[data-go="dogs"]');
      const card = page.locator('article.dc', { hasText: 'Test Dog One' });
      const head = card.locator('section.bb-sec .bb-chip');
      await expect(head).toContainText('Pass');
      await expect(head).toContainText('Testing');
      await expect(head.locator('.bb-secpts')).toHaveText('80 of 85');
      const hb = await head.boundingBox();
      expect(hb.height).toBeLessThanOrEqual(60);
      expect(hb.height).toBeGreaterThanOrEqual(44);
      await expect(card.locator('.bb-gates').first()).toBeHidden();
      await head.click();
      const groups = card.locator('[data-bb-group]');
      await expect(groups.locator('.bb-secgh')).toContainText(['Must pass 4 of 4 met', 'Section A 5 of 5', 'Section B 20 of 25', 'Section C 25 of 25', 'Section D 15 of 15', 'Section E 15 of 15']);
      await expect(groups.first().locator('li').first()).toContainText('Patella check');
      await shot(page, 'dogcard', w);
      const lines = await card.locator('.bb-gbtn').count();
      expect(lines).toBeGreaterThan(8);
      for (let i = 0; i < lines; i += 3) {
        const b = card.locator('.bb-gbtn').nth(i);
        const band = await b.getAttribute('data-bb-band-go');
        await b.click();
        await expect(page).toHaveURL(/#\/breed\/score\.sub-test-dog-1$/);
        await expect(page.locator('#bbRoot details.bb-band[data-bb-band="' + band + '"]')).toHaveAttribute('open', '');
        await page.goBack();
        await expect(page.locator('#main h2')).toContainText('Dogs');
        if (!(await card.locator('details.bb-secd').getAttribute('open') !== null)) await head.click();
      }
      await head.click();
      await expect(card.locator('details.bb-secd')).not.toHaveAttribute('open', '');
      await noSideways(page);
    });

    test('look: Lexend 400/500/600 only, nothing under 14px, no outline wider than 1px, icon colours read in light and dark', async ({ page }) => {
      await openBB(page, '#/breed/score.sub-test-dog-1');
      const bad = await page.locator('#bbRoot *').evaluateAll((els) => els.filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map((e) => {
        const c = getComputedStyle(e);
        return { w: c.fontWeight, s: parseFloat(c.fontSize), o: c.outlineStyle !== 'none' ? parseFloat(c.outlineWidth) : 0, t: e.textContent.trim().slice(0, 20) };
      }).filter((x) => !['400', '500', '600'].includes(x.w) || (x.t && x.s < 14) || x.o > 1));
      expect(bad).toEqual([]);
      const contrast = () => page.evaluate(() => {
        const lum = (rgb) => { const v = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const bg = getComputedStyle(document.querySelector('#bbRoot .bb-vbox')).backgroundColor;
        return Array.from(document.querySelectorAll('#bbRoot .bb-bandic')).map((e) => { const a = lum(getComputedStyle(e).color), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); });
      });
      for (const r of await contrast()) expect(r).toBeGreaterThanOrEqual(3);
      await page.emulateMedia({ colorScheme: 'dark' });
      for (const r of await contrast()) expect(r).toBeGreaterThanOrEqual(3);
      await shot(page, 'score-dark', w);
    });
  });
}
