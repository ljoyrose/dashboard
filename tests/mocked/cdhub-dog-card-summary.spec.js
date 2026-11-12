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

  test('size from the latest weight: Lisa\'s cut-off rows set the badge, the coloured line and the room check', async ({ page, guard }) => {
    const w = guard.world;
    const SUBJ = csv('id,tenant_id,name,sex,dob,kind,neuter_status,size_band', [
      'sub-x1,t,Pretend Dam One,Female,2021-01-01,Breeding Female,entire,10-25kg (medium)',
      'sub-x2,t,Pretend Stud Two,Male,2022-01-01,Stud,entire,',
      'sub-x3,t,Pretend No Weight,Female,2022-01-01,Breeding Female,entire,25kg+ (large)'
    ]);
    const RULES = csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by', [
      'r1,t,size_colour.small,orange,2026-11-11,Pretend poster,,,',
      'r2,t,size_colour.medium,green,2026-11-11,Pretend poster,,,',
      'r3,t,size_from_kg.medium,10,2026-01-01,Pretend vet,,,',
      'r4,t,size_from_kg.large,25,2026-01-01,Pretend vet,,,',
      'r5,t,size_from_kg.large,12,2099-01-01,Pretend future row,,,'
    ]);
    put(w, 'BLD-subject.csv', SUBJ);
    put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-x1,Active', 's2,t,sub-x2,Active', 's3,t,sub-x3,Active']));
    put(w, 'BLD-weight.csv', WEIGHT);
    put(w, 'BLD-breeding_rule.csv', RULES);
    await HUBS.cdhub.open(page, guard);
    await page.evaluate(() => go('dogs/sub-x1'));
    const card = page.locator('#rows article.dc');
    await expect(card).toHaveAttribute('data-size', 'small');          // 8.4 kg beats the record's medium
    await expect(card).toHaveAttribute('data-size-from', 'weight');
    await expect(card.locator('[data-k="size"]')).toHaveText('Small');
    await expect(card.locator('[data-k="size"]')).toHaveAttribute('title', /8\.4 kg on 12\/01\/26 · cut-offs: Pretend vet/);
    expect(await card.evaluate((e) => getComputedStyle(e).borderLeftWidth)).toBe('3px');
    await page.evaluate(() => go('dogs/sub-x2'));
    await expect(page.locator('#rows article.dc')).toHaveAttribute('data-size', 'medium');   // 14.1 kg; the future row is not in force
    await page.evaluate(() => go('dogs/sub-x3'));
    await expect(page.locator('#rows article.dc')).toHaveAttribute('data-size-from', 'record');  // no weight: the record stands
    await expect(page.locator('#rows [data-k="size"]')).toHaveText('Large');
    expect(await page.evaluate(() => roomDogs(['sub-x1', 'sub-x2']).map((d) => d.size))).toEqual(['small', 'medium']);
  });

  test('size: no cut-off rows means no size from weight; a row without a source does not count', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-weight.csv', WEIGHT);
    put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by', [
      'r3,t,size_from_kg.medium,10,2026-01-01,,,,', 'r4,t,size_from_kg.large,25,2026-01-01,Pretend vet,,,']));
    await HUBS.cdhub.open(page, guard);
    expect(await page.evaluate(() => CD.sizeCut)).toBeNull();
    await page.evaluate(() => go('dogs/sub-x1'));
    await expect(page.locator('#rows article.dc')).not.toHaveAttribute('data-size', /./);
    await expect(page.locator('#rows [data-k="size"]')).toHaveCount(0);
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
