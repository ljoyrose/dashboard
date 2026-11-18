// Size band with no weighing (OV11 for Lisa, 15 Nov 2026): breed sizes like "Mini 8-12kg" and "Lge Mini/Sml Med 12-16kg"
// were blank. The band is worked out from the latest weighing, else the middle of the kg range in the size cell, both
// against the owner's size_from_kg rule rows. No rows: no band (nothing fixed in code). Invented dogs and rows only.
const { test, expect, HUBS } = require('../fixtures/job34/load');
const { SINK, csv, put } = require('../support/dog-photo-world');

const RULES = [
  { rule_key: 'size_from_kg.medium', value: '10', effective_from: '2026-01-01', source: 'Pretend owner rule' },
  { rule_key: 'size_from_kg.large', value: '25', effective_from: '2026-01-01', source: 'Pretend owner rule' },
  { rule_key: 'size_colour.small', value: 'blue' }, { rule_key: 'size_colour.medium', value: 'green' }, { rule_key: 'size_colour.large', value: 'red' }];

test.describe('Size band from the kg range midpoint', () => {
  test('the helper: midpoint of the typed range, weight first, nothing without rule rows', async ({ page }) => {
    await page.goto('cdhub/');
    const r = await page.evaluate((rules) => {
      const cut = BLDCapacity.sizeCutoffs(rules, '2026-11-15');
      return {
        mini: BLDCapacity.rangeMidKg('Mini 8-12kg'), lge: BLDCapacity.rangeMidKg('Lge Mini/Sml Med 12-16kg'),
        dash: BLDCapacity.rangeMidKg('25–35 kg'), none: BLDCapacity.rangeMidKg('Medium'),
        a: BLDCapacity.sizeOf(null, 'Mini 8-12kg', cut), b: BLDCapacity.sizeOf('', 'Lge Mini/Sml Med 12-16kg', cut),
        weighed: BLDCapacity.sizeOf('7.5', 'Lge Mini/Sml Med 12-16kg', cut), big: BLDCapacity.sizeOf(null, 'Standard 25-35kg', cut),
        noRows: BLDCapacity.sizeOf(null, 'Mini 8-12kg', BLDCapacity.sizeCutoffs([], '2026-11-15'))
      };
    }, RULES);
    expect([r.mini, r.lge, r.dash]).toEqual([10, 14, 30]);
    expect(Number.isNaN(r.none)).toBe(true);
    expect(r.a).toEqual({ size: 'medium', from: 'range', kg: 10 });
    expect(r.b).toEqual({ size: 'medium', from: 'range', kg: 14 });
    expect(r.weighed).toEqual({ size: 'small', from: 'weight', kg: 7.5 });
    expect(r.big.size).toBe('large');
    expect(r.noRows).toEqual({ size: '', from: '', kg: null });
  });

  test('print: kennel cards for both breed sizes get a band and colour; a weighing wins over the range', async ({ page }) => {
    const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
    const CORS = { 'access-control-allow-origin': '*' };
    const tag = (ref, t) => ({ tag: t, kind: 'subject', ref_id: ref, active: 'true' });
    const tables = {
      area: [{ id: 'ar-a', code: 'Room A' }], requirement: [], area_access: [], area_capacity: [], litter: [],
      subject: [
        { id: 'd1', name: 'Pretend Mini', sex: 'Female', size_band: 'Mini 8-12kg' },
        { id: 'd2', name: 'Pretend Lge Mini', sex: 'Male', size_band: 'Lge Mini/Sml Med 12-16kg' },
        { id: 'd3', name: 'Pretend Weighed', sex: 'Female', size_band: 'Lge Mini/Sml Med 12-16kg' }],
      weight: [{ subject_id: 'd3', performed_on: '2026-01-01', weight_kg: '30' }, { subject_id: 'd3', performed_on: '2026-10-01', weight_kg: '7.2' }],
      occupancy: [{ subject_id: 'd1', area_id: 'ar-a', moved_in: '2026-01-01' }, { subject_id: 'd2', area_id: 'ar-a', moved_in: '2026-01-01' }, { subject_id: 'd3', area_id: 'ar-a', moved_in: '2026-01-01' }],
      qr_tag: [tag('d1', 'AAAAAAAA'), tag('d2', 'BBBBBBBB'), tag('d3', 'CCCCCCCC')],
      breeding_rule: RULES, coat_colour: [], coat_pattern: [], nose_pigment: [], microchip: [], check_type: []
    };
    await page.route(SCRIPT, (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[JSON.parse(route.request().postData()).table] || [] } } });
    });
    await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
    await page.goto('cdhub/staff/print/');
    await page.getByRole('button', { name: 'Dog cards' }).click();
    const card = (id) => page.locator('.dcard[data-dog="' + id + '"]');
    await expect(card('d1').locator('[data-k="size"]')).toHaveAttribute('data-size', 'medium');
    await expect(card('d1')).toHaveAttribute('style', /--c:var\(--sz-green, green\)/);
    await expect(card('d1').locator('[data-k="size"]')).toHaveText('Size: Medium');
    await expect(card('d2').locator('[data-k="size"]')).toHaveAttribute('data-size', 'medium');
    await expect(card('d2')).toHaveAttribute('style', /--c:var\(--sz-green, green\)/);
    await expect(card('d3').locator('[data-k="size"]')).toHaveAttribute('data-size', 'small');   // latest weighing 7.2 kg
    await expect(card('d3')).toHaveAttribute('style', /--c:var\(--sz-blue, blue\)/);
  });

  test('hub: a dog with no weighing takes its band from the range midpoint and says so', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,size_band', [
      'sub-m1,t,Pretend Mini,Female,2021-01-01,Breeding Female,entire,Mini 8-12kg',
      'sub-m2,t,Pretend Lge Mini,Male,2022-01-01,Stud,entire,Lge Mini/Sml Med 12-16kg']));
    put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-m1,Active', 's2,t,sub-m2,Active']));
    put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by', [
      'r3,t,size_from_kg.medium,10,2026-01-01,Pretend vet,,,', 'r4,t,size_from_kg.large,25,2026-01-01,Pretend vet,,,']));
    await HUBS.cdhub.open(page, guard);
    await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
    const r = await page.evaluate(() => ['sub-m1', 'sub-m2'].map((id) => [CD._byId[id].sizeWord, CD._byId[id].sizeFrom, CD._byId[id].sizeWhy]));
    expect(r).toEqual([
      ['medium', 'range', 'no weighing · 10 kg, middle of Mini 8-12kg'],
      ['medium', 'range', 'no weighing · 14 kg, middle of Lge Mini/Sml Med 12-16kg']]);
    await page.evaluate(() => go('dogs/sub-m1'));
    await expect(page.locator('#rows article.dc')).toHaveAttribute('data-size', 'medium');
  });
});
