// Dog card fixes, 12 Nov 2026 (Lisa): the weight graph is back, Add weight in the weighings panel (no source column),
// vaccine codes read as words, Add vaccination and Remove (newest only), status words without code letters ("Bitch",
// not "BI Bitch"), no "Colour" word, and the microchip is a plain line. Invented dogs and rows only; pretend save script.
const { test, expect, HUBS } = require('../fixtures/job34/load');
const { SINK, csv, put } = require('../support/dog-photo-world');

const SUBJECT = csv('id,tenant_id,name,sex,dob,kind,neuter_status', [
  'sub-x1,t,Pretend Dam One,Female,2021-01-01,Breeding Female,entire',
  'sub-x2,t,Pretend Stud Two,Male,2022-01-01,Stud,entire']);
const STATUS = csv('id,tenant_id,subject_id,state', ['s1,t,sub-x1,Active', 's2,t,sub-x2,Active']);
const WEIGHT = csv('id,subject_id,performed_on,weight_kg,unit,body_condition_score,bcs_scale,source', [
  'w1,sub-x1,2026-01-01,8.1,kg,,,Pretend source', 'w2,sub-x1,2026-02-12,8.4,kg,5,9,Pretend source', 'w3,sub-x1,2026-03-12,8.9,kg,,,Pretend source']);
const VAX_H = 'id,tenant_id,subject_id,event_kind,product,product_shorthand,diseases_covered,batch,batch_use_by,given_on,route,administered_by,practice,titre_result,titre_lab,titre_protective,next_due_on_card,next_due_source,certificate_media_id,source,ruling_needed,note,voided_on,voided_by';
const VAX = csv(VAX_H, [
  'v1,t,sub-x1,vaccination,Pretend DHP,DHP,distemper;adenovirus_ich;parvovirus,,,2025-01-15,,,Pretend Vets,,,,2026-01-15,card,https://example.test/pretend-card.jpg,Pretend,,,,',
  'v2,t,sub-x1,vaccination,Pretend KC,KC,bordetella_kennel_cough;parainfluenza;canine_herpesvirus,,,2025-06-01,,,,,,,,,,Pretend,,,,',
  'v0,t,sub-x1,vaccination,Pretend Old,OLD,rabies,,,2024-01-01,,,,,,,,,,Pretend,,,2025-01-01T10:00:00+00:00,Pretend Staff']);

async function open(page, guard) {
  const w = guard.world;
  put(w, 'BLD-subject.csv', SUBJECT); put(w, 'BLD-subject_status.csv', STATUS);
  put(w, 'BLD-weight.csv', WEIGHT); put(w, 'BLD-vaccination.csv', VAX);
  await HUBS.cdhub.open(page, guard);
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
}
async function saves(page, answer) {
  const bodies = [];
  await page.route(SINK, async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); bodies.push(b);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer ? answer(b) : { ok: true, result: { status: 'saved', id: 'new-1' } }) });
  });
  return bodies;
}
const dog = (page) => page.locator('#rows article.dc');
async function openMore(page) { await dog(page).locator('details[data-k="more"] > summary').click(); await dog(page).locator('details.vacc > summary').click(); }

test.describe('CD Hub dog card, 12 Nov 2026 fixes', () => {
  test('weight graph: small line on the card, a labelled graph in the fold and in the weighings panel', async ({ page, guard }) => {
    await open(page, guard);
    await page.evaluate(() => go('dogs/sub-x1'));
    await expect(dog(page).locator('[data-k="wgraph"] svg.spk')).toHaveCount(1);   // visible without opening anything
    await expect(dog(page).locator('[data-k="wgraph"]').first()).toBeVisible();
    await dog(page).locator('details.wtc > summary').click();
    const g = page.locator('#wpanel svg.wgraph');
    await expect(g).toHaveAttribute('aria-label', 'Weight from 8.1 kg on 1 Jan 2026 to 8.9 kg on 12 Mar 2026');
    await expect(g.locator('circle')).toHaveCount(3);
    await expect(page.locator('#wpanel thead th')).toHaveText(['date', 'weight', 'change', 'BCS']);   // no source column
    await expect(page.locator('#wpanel')).not.toContainText('Pretend source');
  });

  test('Add weight: date defaults to today, kg and optional BCS, sent as action weighing; the new weight shows', async ({ page, guard }) => {
    await open(page, guard);
    const bodies = await saves(page);
    await page.evaluate(() => go('dogs/sub-x1'));
    await dog(page).locator('details.wtc > summary').click();
    const f = page.locator('#wpanel form[data-weigh-form]');
    const today = await page.evaluate(() => todayLondon());
    await expect(f.locator('input[name=on]')).toHaveValue(today);
    await f.locator('input[name=kg]').fill('999');
    await f.locator('button[type=submit]').click();
    await expect(f.locator('[data-weigh-msg]')).toHaveText('Type the weight in kg, e.g. 12.4');
    expect(bodies.length).toBe(0);
    await f.locator('input[name=kg]').fill('9.25');
    await f.locator('select[name=bcs]').selectOption('6');
    await f.locator('button[type=submit]').click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0].action).toBe('weighing');
    expect(bodies[0].fields).toEqual({ subject_id: 'sub-x1', performed_on: today, weight_kg: '9.25', body_condition_score: '6' });
    await expect(page.locator('#wpanel tbody tr').first()).toContainText('9.25 kg');
    await expect(dog(page).locator('[data-k="weight"]')).toContainText('9.25 kg');
  });

  test('an older save script says so plainly and nothing changes', async ({ page, guard }) => {
    await open(page, guard);
    await saves(page, () => ({ ok: false, code: 'BAD_REQUEST', message: 'Unknown action.' }));
    await page.evaluate(() => go('dogs/sub-x1'));
    await dog(page).locator('details.wtc > summary').click();
    const f = page.locator('#wpanel form[data-weigh-form]');
    await f.locator('input[name=kg]').fill('9.3');
    await f.locator('button[type=submit]').click();
    await expect(f.locator('[data-weigh-msg]')).toHaveText('Not saved: The save script has not been updated for this yet. Nothing was saved.');
    await expect(page.locator('#wpanel tbody tr')).toHaveCount(3);
  });

  test('vaccines: codes as words, removed rows hidden, card link, and Remove only on the newest', async ({ page, guard }) => {
    await open(page, guard);
    await page.evaluate(() => go('dogs/sub-x1'));
    await openMore(page);
    const rows = dog(page).locator('details.vacc .dcs-bd > .dcs-row');
    await expect(rows).toHaveCount(2);   // v0 is voided
    await expect(rows.nth(1).locator('[data-k="covers"]')).toHaveText('Distemper, Hepatitis (adenovirus), Parvovirus');
    await expect(rows.nth(0).locator('[data-k="covers"]')).toHaveText('Kennel cough (Bordetella), Parainfluenza, Canine herpesvirus');
    await expect(rows.nth(1).locator('[data-k="vcard"]')).toHaveAttribute('href', 'https://example.test/pretend-card.jpg');
    await expect(rows.nth(0).locator('[data-vax-void]')).toHaveCount(1);
    await expect(rows.nth(1).locator('[data-vax-void]')).toHaveCount(0);
    expect(await page.evaluate(() => vaxWords('some_new_thing;rabies'))).toBe('Some new thing, Rabies');
  });

  test('Add vaccination sends one row; Remove sends vaccination_void for the newest and the one before becomes newest', async ({ page, guard }) => {
    await open(page, guard);
    const bodies = await saves(page, (b) => ({ ok: true, result: { status: 'saved', id: b.action === 'vaccination' ? 'v-new' : b.fields.id } }));
    await page.evaluate(() => go('dogs/sub-x1'));
    await openMore(page);
    const f = dog(page).locator('form[data-vax-form]');
    await f.locator('input[name=on]').fill('2026-02-01');
    await f.locator('input[name=product]').fill('Pretend L4');
    await f.locator('input[value=leptospirosis]').check();
    await f.locator('input[name=card]').fill('https://example.test/pretend-card-2.jpg');
    await f.locator('button[type=submit]').click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]).toMatchObject({ action: 'vaccination', fields: { subject_id: 'sub-x1', given_on: '2026-02-01', product: 'Pretend L4', diseases_covered: 'leptospirosis', certificate_link: 'https://example.test/pretend-card-2.jpg' } });
    const rows = dog(page).locator('details.vacc .dcs-bd > .dcs-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Leptospirosis');
    page.once('dialog', (d) => d.accept());
    await rows.nth(0).locator('[data-vax-void]').click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]).toMatchObject({ action: 'vaccination_void', fields: { subject_id: 'sub-x1', id: 'v-new' } });
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('[data-vax-void]')).toHaveCount(1);
  });

  test('status words without code letters, no "Colour" word, and the microchip is a plain line', async ({ page, guard }) => {
    await open(page, guard);
    await page.evaluate(() => go('dogs'));
    const one = page.locator('#rows article.dc', { hasText: 'Pretend Dam One' });
    await expect(one.locator('.nl .st')).toHaveCount(0);   // no role badge on the card: sex is the icon on the photo
    const chips = await page.locator('.sfb.st').allTextContents();
    expect(chips.map((t) => t.replace(/\s*\d+$/, '').trim())).toEqual(expect.arrayContaining(['Bitch', 'Stud']));
    await expect(page.locator('#rows')).not.toContainText(/\bBI\b/);
    await expect(one.locator('[data-k="colour"]')).not.toContainText('Colour');
    await expect(one.locator('[data-k="chip"]')).toHaveText('no chip recorded');
    expect(await one.locator('[data-k="chip"]').evaluate((e) => e.tagName)).toBe('DIV');
    for (const t of await page.locator('.sfb.st').allTextContents()) expect(t).not.toMatch(/^[A-Z]{2}[A-Z]/);
  });

  test('size is worked out from the latest weight only: Add weight changes every size mark (frame, word, room check)', async ({ page, guard }) => {
    put(guard.world, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by', [
      'r3,t,size_from_kg.medium,10,2026-01-01,Pretend vet,,,', 'r4,t,size_from_kg.large,25,2026-01-01,Pretend vet,,,']));
    await open(page, guard);
    await saves(page);
    await page.evaluate(() => go('dogs/sub-x1'));
    const card = dog(page);
    await expect(card).toHaveAttribute('data-size', 'small');
    await expect(card.locator('[data-k="size"]')).toHaveText('Toy/Mini');
    const frame = () => card.locator('.ph').evaluate((e) => getComputedStyle(e).borderTopColor);
    const small = await frame();
    expect(await page.evaluate(() => [roomDogs(['sub-x1'])[0].size, sizeOn(CD._byId['sub-x1'])])).toEqual(['small', 'small']);
    await card.locator('details.wtc > summary').click();
    const f = page.locator('#wpanel form[data-weigh-form]');
    await f.locator('input[name=kg]').fill('12.5');
    await f.locator('button[type=submit]').click();
    await expect(card).toHaveAttribute('data-size', 'medium');
    await expect(card.locator('[data-k="size"]')).toHaveText('Medium');
    expect(await frame()).not.toBe(small);
    expect(await page.evaluate(() => [roomDogs(['sub-x1'])[0].size, sizeOn(CD._byId['sub-x1'])])).toEqual(['medium', 'medium']);
    expect(await page.evaluate(() => sizeDot(CD._byId['sub-x1'].sizeWord))).toContain('data-size="medium"');
    // the dog with no weight has no size at all, whatever its record says
    await page.evaluate(() => go('dogs/sub-x2'));
    await expect(dog(page)).not.toHaveAttribute('data-size', /./);
  });

  test('header: one sex mark (the photo icon), Edit opens the fields and saves only what changed as dog_details', async ({ page, guard }) => {
    put(guard.world, 'BLD-coat_colour.csv', csv('id,name,base_family,swatch_hex,nose_pigment_applies', ['col-a,Pretend Red,red,#aa3322,false']));
    await open(page, guard);
    const bodies = await saves(page, () => ({ ok: true, result: { status: 'edited', changed: ['name'] } }));
    await page.evaluate(() => go('dogs/sub-x1'));
    const card = dog(page);
    await expect(card.locator('.gicon')).toHaveCount(1);
    await expect(card.locator('.nl .st, .szb')).toHaveCount(0);
    await card.locator('[data-dog-edit]').click();
    const f = card.locator('form[data-dedit-form]');
    await expect(f.locator('input[name=name]')).toHaveValue('Pretend Dam One');
    await f.locator('input[name=chip_number]').fill('123');
    await f.locator('button[type=submit]').click();
    await expect(f.locator('[data-dedit-msg]')).toHaveText('A microchip number is 15 digits.');
    await f.locator('input[name=chip_number]').fill('');
    await f.locator('input[name=name]').fill('Pretend Dam Renamed');
    await f.locator('select[name=coat_colour_id]').selectOption('col-a');
    await f.locator('button[type=submit]').click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]).toMatchObject({ action: 'dog_details', fields: { subject_id: 'sub-x1', name: 'Pretend Dam Renamed', coat_colour_id: 'col-a' } });
    expect(Object.keys(bodies[0].fields).sort()).toEqual(['coat_colour_id', 'name', 'subject_id']);
    await expect(dog(page).locator('.nm')).toHaveText('Pretend Dam Renamed');
    await expect(dog(page).locator('[data-k="colour"]')).toContainText('Pretend Red');
  });

  test('saving on this device: the staff page set-up is reused, and a #join link switches it on in one tap', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    expect(await page.evaluate(() => sinkOn())).toBe(false);
    await page.evaluate(() => { localStorage.setItem('bld.scriptUrl', 'https://script.google.com/a/macros/example.test/s/PRETENDSCRIPT/exec'); localStorage.setItem('bld.device.code', 'pretend-code'); });
    expect(await page.evaluate(() => sinkOn())).toBe(true);
    await page.evaluate(() => go('round'));
    await expect(page.locator('#sinkcard')).toContainText('Saving on this device: on');
    await page.locator('#sinkoff').click();
    expect(await page.evaluate(() => sinkOn())).toBe(false);   // switching off here wins over the staff page's set-up
    await expect(page.locator('#sinkcard')).toContainText('The save address is already on this phone');
    await expect(page.locator('#sinkurl')).toBeHidden();
    await page.locator('#sinkcode').fill('pretend-code-2');
    await page.locator('#sinkon').click();
    expect(await page.evaluate(() => [sinkOn(), localStorage.getItem('cdhub.sink.code')])).toEqual([true, 'pretend-code-2']);
  });

  test('licence counts are one bar: bitches and studs as parts of the adults, a tick when the counts agree, a part opens its list', async ({ page, guard }) => {
    await open(page, guard);
    await page.evaluate(() => go('today'));
    const bar = page.locator('[data-k="licence"]');
    await expect(bar).toBeVisible();
    await expect(page.locator('#main')).not.toContainText('Both counts agree');
    await expect(bar.locator('.lbok, .lbgap')).toHaveCount(1);
    await expect(bar.locator('.lbhead')).toContainText('adults');
    const html = await page.evaluate(() => licenceBar({ adults: new Array(27), bitches: new Array(25), active: new Array(24), studs: new Array(2) }));
    expect(html).toContain('data-list="active"'); expect(html).toContain('1 more in law'); expect(html).toContain('<b>2</b> studs');
    expect(await page.evaluate(() => licenceBar({ adults: new Array(27), bitches: new Array(25), active: new Array(25), studs: new Array(2) }))).toContain('lbok');
  });

  test('a saved reading shows at once in the count and Kept readings; Empty saves room_empty for the slot', async ({ page, guard }) => {
    await open(page, guard);
    const bodies = await saves(page, () => ({ ok: true, result: { status: 'saved', id: 'ar-new', at: '2026-11-11T09:00:00Z' } }));
    await page.evaluate(() => go('round'));
    await page.locator('#rdate').fill('2026-11-11');
    await page.locator('#rdate').dispatchEvent('change');
    await expect(page.locator('#rstat')).toContainText('0 with a temperature');
    const min = page.locator('.tmin[data-slot="am"]').first();
    const area = await min.getAttribute('data-area');
    await min.fill('11.3'); await min.blur();
    const max = page.locator(`.tmax[data-area="${area}"][data-slot="am"]`);
    await max.fill('13.2'); await max.blur();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]).toMatchObject({ table: 'area_reading', fields: { area_id: area, min_c: '11.3', max_c: '13.2' } });
    await expect(page.locator('#rstat')).toContainText('1 with a temperature');
    await expect(page.locator('#kept-readings')).toContainText('11.3–13.2');
    page.once('dialog', (d) => d.accept());
    await page.locator(`.rempty[data-area="${area}"][data-slot="pm"]`).click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]).toMatchObject({ table: 'area_reading', fields: { area_id: area, room_empty: 'yes' } });
    expect(bodies[1].fields.min_c).toBeUndefined();
    await expect(page.locator('#kept-readings')).toContainText('Room empty');
  });

  test('Round "add a dog": puppies under their litter heading, a whole-litter-with-dam choice, cabin names not codes', async ({ page, guard }) => {
    await open(page, guard);
    await page.evaluate(() => {
      const born = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
      CD.litters = [{ id: 'lit-x', dam_subject_id: 'sub-x1' }];
      ['Pretend Pup A', 'Pretend Pup B'].forEach((n, i) => { const d = { id: 'sub-p' + i, name: n, birthLitter: 'lit-x', dob: born, sex: 'Female', state: 'Active', classification: '', area_id: '', off: '', treats: [], weights: [], findings: [], dna: [], vacc: [], littersAsDam: [] }; CD.dogs.push(d); CD._byId[d.id] = d; });
    });
    const html = await page.evaluate(() => roundPickOptions(CD.dogs.filter((d) => !d.birthLitter), [], { 'sub-x2': (CD.allAreas[0] || { id: 'a' }).id }, 'other'));
    expect(html).toContain('<optgroup label="Pretend Dam One litter">');
    expect(html).toContain('value="litter:lit-x">Whole litter with Pretend Dam One (2)');
    expect(html).toContain('Pretend Pup A');
    expect(html).not.toMatch(/in area-/);
  });
});
