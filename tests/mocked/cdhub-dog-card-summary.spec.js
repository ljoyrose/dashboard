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
    await expect(card.locator('[data-k="weight"]')).toHaveText('8.4 kg ↑ 0.3 · 12/01/26 BCS 5');
    await expect(card.locator('[data-k="bcs"]')).toHaveAttribute('title', 'BCS 5/9 on 12/01/26');
    await expect(card.locator('[data-k="meds"]')).toHaveText('2 medications · last 03/11/26');
    await expect(card.locator('[data-k="dna"] [data-dna="clear"]')).toHaveText('PRA clear');
    await expect(card.locator('[data-k="dna"] [data-dna="carrier"]')).toHaveText('VWD carrier');
    await expect(card.locator('[data-k="dna"] [data-dna="affected"]')).toHaveText('DM affected');
    await expect(card.locator('[data-k="litters"]')).toHaveText('2 litters · last 02/06/25');

    // layout A (Lisa 12 Nov 2026): weight, medications and chip show; DNA, litters and the rest sit behind More
    await expect(card.locator('[data-k="weight"]')).toBeVisible();
    await expect(card.locator('[data-k="meds"]')).toBeVisible();
    await expect(card.locator('.dc-sects > [data-k="chip"]')).toBeVisible();   // a plain line now, not a fold (12 Nov)
    await expect(card.locator('[data-k="more"]')).not.toHaveAttribute('open', '');
    await expect(card.locator('[data-k="dna"]')).toBeHidden();
    await expect(card.locator('[data-k="litters"]')).toBeHidden();
    await card.locator('[data-k="more"] > summary').click();
    await expect(card.locator('[data-k="dna"]')).toBeVisible();
    await card.locator('[data-dam-link]').click();
    await expect(page).toHaveURL(/#\/litters\/sub-x1$/);
    await expect(page.locator('#nav button[data-go="map"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#main h2', { hasText: 'Litters' })).toHaveCount(0);
    await expect(page.locator('#lm')).toHaveCount(0);

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
    await expect(card.locator('[data-k="colour"]')).not.toContainText('Colour');   // the word itself is gone (12 Nov)
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
    await expect(card.locator('[data-k="size"]')).toHaveText('Toy/Mini');
    await expect(card.locator('[data-k="size"]')).toHaveAttribute('title', /8\.4 kg on 12\/01\/26/);
    expect(await card.locator('.ph').evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('3px');   // the photo has the size-coloured frame (12 Nov)
    await page.evaluate(() => go('dogs/sub-x2'));
    await expect(page.locator('#rows article.dc')).toHaveAttribute('data-size', 'medium');   // 14.1 kg; the future row is not in force
    await page.evaluate(() => go('dogs/sub-x3'));
    await expect(page.locator('#rows article.dc')).not.toHaveAttribute('data-size', /./);  // no weight: no size (never the record, 12 Nov)
    await expect(page.locator('#rows [data-k="size"]')).toHaveCount(0);
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

  test('vaccinations: count, last date, next due from the card (late marked), newest first inside', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-vaccination.csv', csv('id,tenant_id,subject_id,event_kind,product,product_shorthand,diseases_covered,batch,batch_use_by,given_on,route,administered_by,practice,titre_result,titre_lab,titre_protective,next_due_on_card,next_due_source,certificate_media_id,source,ruling_needed,note', [
      'v1,t,sub-x1,vaccination,Pretend Vax Long Name,PVX,DHP,,,2024-02-01,,,,,,,2025-02-01,Pretend card,,Pretend,,',
      'v2,t,sub-x1,vaccination,Pretend Vax Long Name,PVX,DHP,,,2025-02-03,,,,,,,2026-02-03,Pretend card,,Pretend,,',
      'v3,t,sub-x2,vaccination,Pretend Vax,PV,L4,,,2026-10-01,,,,,,,2099-10-01,Pretend card,,Pretend,,'
    ]));
    await HUBS.cdhub.open(page, guard);
    await page.evaluate(() => go('dogs/sub-x1'));
    const v = page.locator('#rows [data-k="vacc"]');
    await expect(v).toHaveText('2 vaccinations \u00b7 last 03/02/25 due 03/02/26');
    await expect(v.locator('[data-due]')).toHaveAttribute('data-due', 'late');
    await page.locator('#rows details.vacc').locator('xpath=ancestor::details[@data-k="more"]').first().locator('summary').first().click();
    await page.locator('#rows details.vacc summary').click();
    await expect(page.locator('#rows details.vacc .dcs-row').first()).toContainText('03/02/25');
    await page.evaluate(() => go('dogs/sub-x2'));
    await expect(page.locator('#rows [data-k="vacc"] [data-due]')).toHaveAttribute('data-due', 'ok');
    // next due is blank by design on some rows: say so (licence audit 12 Nov, item 28)
    expect(await page.evaluate(() => { var d = CD._byId['sub-x2']; var keep = d.vacc; d.vacc = [{ on: '2026-10-01', product: 'PV', due: '' }]; var h = vaccRow(d); d.vacc = keep; return h; })).toContain('next due not entered');
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

test('Areas: a room\'s size columns come from its own capacity rows, never fixed kg bands', async ({ page, guard }) => {
  const w = guard.world;
  const AREA = csv('id,tenant_id,code,grouping,group_sort,area_value,area_unit_id,m2_confirmed,m2_note,use,source', ['ar-a,t,Room A,A,1,10,u-m2,yes,,,', 'ar-b,t,Room B,A,1,8,u-m2,yes,,,']);
  put(w, 'BLD-area.csv', AREA);
  put(w, 'BLD-area_capacity.csv', csv('id,area_id,access_type,size_band,max_dogs,basis', [
    'c1,ar-a,limited,Pretend medium band (medium),2,', 'c2,ar-a,limited,Pretend small band (small),3,', 'c3,ar-a,limited,small + pups,1,']));
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('areas/ar-a'));
  await expect(page.locator('[data-room="ar-a"] thead th')).toHaveText(['flap', 'Small', 'Medium', 'Small + pups']);
  await page.evaluate(() => go('areas/ar-b'));
  await expect(page.locator('[data-nolimits="ar-b"]')).toHaveText('no limits recorded');
});

test('Areas room card: limits as door-sign chips for the current flap mode, the table folded, a Print sign link', async ({ page, guard }) => {
  const w = guard.world;
  put(w, 'BLD-area.csv', csv('id,tenant_id,code,grouping,group_sort,area_value,area_unit_id,m2_confirmed,m2_note,use,source', ['ar-a,t,Room A,A,1,10,u-m2,yes,,,']));
  put(w, 'BLD-area_access.csv', csv('id,area_id,access_type,reason', ['aa-a,ar-a,limited,invented']));
  put(w, 'BLD-area_capacity.csv', csv('id,area_id,access_type,size_band,max_dogs,basis', [
    'c1,ar-a,limited,Pretend (medium),2,', 'c2,ar-a,limited,Pretend (small),3,', 'c3,ar-a,limited,Pretend (large),0,', 'c4,ar-a,limited,small + pups,1,', 'c5,ar-a,free,Pretend (small),9,']));
  put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by', ['r2,t,size_colour.medium,green,2026-11-11,Pretend poster,,,']));
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('areas/ar-a'));
  const room = page.locator('[data-room="ar-a"]');
  await expect(room.locator('[data-k="limits"] .lim')).toHaveText(['3 small', 'or 2 medium']);
  await expect(room.locator('.lim[data-size="medium"]')).toHaveAttribute('style', /green/);
  await expect(room.locator('table')).toBeHidden();
  await room.locator('details.allfig summary').click();
  await expect(room.locator('table')).toBeVisible();
  await expect(room.locator('[data-print-sign="ar-a"]')).toHaveAttribute('href', 'staff/print/');
});

test('Areas room card: today\'s temperature line in the round\'s words, the limit from the band rows, and a history link', async ({ page, guard }) => {
  const w = guard.world;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  put(w, 'BLD-area.csv', csv('id,tenant_id,code,grouping,group_sort,area_value,area_unit_id,m2_confirmed,m2_note,use,source', ['ar-a,t,Room A,A,1,10,u-m2,yes,,,', 'ar-b,t,Room B,A,1,8,u-m2,yes,,,']));
  put(w, 'BLD-temperature_band.csv', csv('id,band,age_from_days,age_to_days,min_temp,max_temp,basis,note', ['tb-1,Pretend adult,,,10,26,Pretend vet,']));
  put(w, 'BLD-thermometer.csv', csv('id,tenant_id,area_id,name', ['th-1,t,ar-a,Pretend left', 'th-2,t,ar-a,Pretend right']));
  put(w, 'BLD-area_reading.csv', csv('id,area_id,thermometer_id,min_c,max_c,period_start,taken_at,room_empty,corrects_id', [
    `rd-1,ar-a,th-1,12,15,${today}T08:00:00,${today}T08:05:00,,`,
    `rd-2,ar-a,th-1,9,15,${today}T18:00:00,${today}T18:05:00,,`,
    `rd-3,ar-a,th-2,12,14,${today}T08:00:00,${today}T08:05:00,,`]));
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('areas/ar-a'));
  const t = page.locator('[data-temp="ar-a"]');
  await expect(t.locator('> div').first()).toContainText('Pretend left AM 12.0–15.0 ✓ · PM Outside 9.0–15.0');
  await expect(t.locator('[data-tstate="out"]')).toHaveClass(/pill no/);           // a ring, never a fill
  await expect(t.locator('> div').nth(1)).toContainText('Pretend right AM 12.0–14.0 ✓');
  await expect(t.locator('[data-temp-limit]')).toHaveText('Limit 10.0–26.0 °C');
  await expect(t.locator('a')).toHaveAttribute('href', './history.html');
  await page.evaluate(() => go('areas/ar-b'));
  await expect(page.locator('[data-temp="ar-b"]')).toHaveCount(0);                    // no thermometer here: no line
});

test('dated limits: a past day uses the cut-offs in force then and the weight on or before it; room rows are read as at that day', async ({ page, guard }) => {
  const w = guard.world;
  put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date', [
    'r1,t,size_from_kg.medium,10,2026-01-01,Pretend poster,,,,', 'r2,t,size_from_kg.large,25,2026-01-01,Pretend poster,,,,2026-06-30',
    'r3,t,size_from_kg.large,20,2026-07-01,Pretend council,,,,']));
  await HUBS.cdhub.open(page, guard);
  const r = await page.evaluate(() => {
    const d = { weights: [{ on: '2026-03-01', kg: 22 }, { on: '2026-11-01', kg: 9 }], size: '' };
    const cap = [{ area_id: 'z', access_type: 'free', size_band: 'small', max_dogs: '4', to_date: '2026-11-11' },
      { area_id: 'z', access_type: 'free', size_band: 'small', max_dogs: '3', from_date: '2026-11-12' }];
    const four = [1, 2, 3, 4].map((i) => ({ id: 'q' + i, size: 'small' }));
    return { march: sizeOn(d, '2026-03-15'), august: sizeOn(d, '2026-08-01'), nov: sizeOn(d, '2026-11-05'),
      on11: BLDCapacity.check({ areaId: 'z', access: 'free', capacity: cap, dogs: four, date: '2026-11-11' }).status,
      on12: BLDCapacity.check({ areaId: 'z', access: 'free', capacity: cap, dogs: four, date: '2026-11-12' }).status };
  });
  expect(r).toEqual({ march: 'medium', august: 'large', nov: 'small', on11: 'ok', on12: 'over' });   // 22 kg: medium under the 25 kg row, large under the 20 kg row
});
