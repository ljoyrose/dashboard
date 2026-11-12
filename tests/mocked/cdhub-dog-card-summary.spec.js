// CD Hub dog card summary (Lisa's dog card mock-up, 7 Nov 2026): weight change, last medication date,
// DNA clear/carrier/affected pills, and litters as dam with a link. Invented rows only. Dates DD/MM/YY.
const { test, expect, HUBS } = require('../fixtures/job34/load');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const SUBJECT = csv('id,tenant_id,name,sex,dob,kind,neuter_status,size_band', [
  'sub-x1,t,Pretend Dam One,Female,2021-01-01,Breeding Female,entire,',
  'sub-x2,t,Pretend Stud Two,Male,2022-01-01,Stud,entire,'
]);
const STATUS = csv('id,tenant_id,subject_id,state', ['s1,t,sub-x1,Active', 's2,t,sub-x2,Active']);
const WEIGHT = csv('id,subject_id,performed_on,weight_kg,unit,body_condition_score,bcs_scale,source', [
  'w1,sub-x1,2026-01-01,8.1,kg,,,Pretend',
  'w2,sub-x1,2026-01-12,8.4,kg,5,9,Pretend',
  'w3,sub-x2,2026-02-01,14.6,kg,,,Pretend',
  'w4,sub-x2,2026-02-15,14.1,kg,,,Pretend'
]);
const DISPENSE = csv('id,subject_id,given_on,product,presentation,dose_volume,route,source', [
  'm1,sub-x1,2026-10-01,Pretend Wormer,,1 tab,Oral,Pretend',
  'm2,sub-x1,2026-11-03,Pretend Spot-on,,1 pipette,Topical,Pretend'
]);
const DNA = csv('id,subject_id,marker_code,genotype,copies,interpretation,ruling_needed,lab,tested_on', [
  'd1,sub-x1,PRA,N/N,0,Clear,,Pretend Lab,2025-03-01',
  'd2,sub-x1,VWD,N/M,1,Carrier,,Pretend Lab,2025-03-01',
  'd3,sub-x1,DM,M/M,2,,,Pretend Lab,2025-03-01'
]);
const LITTER = csv('id,dam_subject_id,sire_subject_id,born_on,notes', [
  'lit-1,sub-x1,sub-x2,2023-11-20,',
  'lit-2,sub-x1,sub-x2,2025-06-02,'
]);

function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}

test.describe('CD Hub dog card summary', () => {
  test('weight change, last medication, DNA pills and litters as dam', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-weight.csv', WEIGHT);
    put(w, 'BLD-dispense.csv', DISPENSE);
    put(w, 'BLD-dna_result.csv', DNA);
    put(w, 'BLD-litter.csv', LITTER);
    await HUBS.cdhub.open(page, guard);

    await page.evaluate(() => go('dogs/sub-x1'));
    const card = page.locator('#rows article.dc');
    await expect(card).toHaveCount(1);
    await expect(card.locator('[data-k="weight"]')).toHaveText('8.4 kg ↑ 0.3 · 12/01/26');
    await expect(card.locator('[data-k="meds"]')).toHaveText('2 medications · last 03/11/26');
    await expect(card.locator('[data-k="dna"] [data-dna="clear"]')).toHaveText('PRA clear');
    await expect(card.locator('[data-k="dna"] [data-dna="carrier"]')).toHaveText('VWD carrier');
    await expect(card.locator('[data-k="dna"] [data-dna="affected"]')).toHaveText('DM affected');
    await expect(card.locator('[data-k="litters"]')).toHaveText('2 litters · last 02/06/25');

    await card.locator('[data-dam-link]').click();
    await expect(page).toHaveURL(/#\/litters\/sub-x1$/);
    await expect(page.locator('#lm')).toHaveValue('sub-x1');

    // a weight drop shows a down arrow; a dog with no litters, meds or DNA shows no such rows
    await page.evaluate(() => go('dogs/sub-x2'));
    const stud = page.locator('#rows article.dc');
    await expect(stud.locator('[data-k="weight"]')).toHaveText('14.1 kg ↓ 0.5 · 15/02/26');
    await expect(stud.locator('[data-k="meds"]')).toHaveText('no medications');
    await expect(stud.locator('[data-k="dna"]')).toHaveCount(0);
    await expect(stud.locator('[data-k="litters"]')).toHaveCount(0);
  });

  test('header: DOB and Colour labels, a small room icon on a phone, status chips folded into Filter', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    await page.setViewportSize({ width: 390, height: 800 });
    await HUBS.cdhub.open(page, guard);
    await page.evaluate(() => go('dogs/sub-x1'));
    const card = page.locator('#rows article.dc');
    await expect(card.locator('[data-k="dob"]')).toHaveText('\u00b7 DOB 01/01/21');
    await expect(card.locator('[data-k="colour"]')).toContainText('Colour');
    const box = await card.locator('.dc-info .ricon').boundingBox();
    expect(box.width).toBeLessThanOrEqual(16);
    expect(box.height).toBeLessThanOrEqual(16);
    await page.evaluate(() => go('dogs'));
    await expect(page.locator('.sfb').first()).toBeHidden();
    await page.locator('[data-fpanel="fp-dogs"]').click();
    await expect(page.locator('.sfb').first()).toBeVisible();
  });

  test('DNA kind reads the lab words first, then the copy count', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    const k = await page.evaluate(() => [
      dnaKind({ interp: 'Not affected' }), dnaKind({ interp: 'Non-carrier' }), dnaKind({ interp: 'At risk' }),
      dnaKind({ copies: '1' }), dnaKind({ copies: '' , interp: 'B/b colour' })
    ]);
    expect(k).toEqual(['clear', 'clear', 'affected', 'carrier', '']);
  });
});
