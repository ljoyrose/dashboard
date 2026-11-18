// Print card size (Lisa 15 Nov 2026): the kennel card printed the typed size cell ("Medium" over "17–22 kg"). It now
// shows the size word only, worked out by the SAME helper as the CD Hub dog page (staff/lib/capacity.js sizeForDog):
// owner override row, else latest weight, else the middle of a typed kg range, against the dated size_from_kg rows.
// Small < 10 kg, medium 10 to under 25 kg, large 25 kg or more. Invented dogs and rows only.
const { test, expect } = require('../fixtures/job34/load');

const RULES = [
  { rule_key: 'size_from_kg.medium', value: '12', effective_from: '2026-01-01', source: 'Pretend older rule' },
  { rule_key: 'size_from_kg.medium', value: '10', effective_from: '2026-11-12', source: 'Pretend owner rule' },
  { rule_key: 'size_from_kg.large', value: '25', effective_from: '2026-01-01', source: 'Pretend owner rule' },
  { rule_key: 'size_colour.small', value: 'orange' }, { rule_key: 'size_colour.medium', value: 'green' }, { rule_key: 'size_colour.large', value: 'blue' }];

test.describe('Print card size word from weight and the dated size rows', () => {
  test('the shared helper: 9.9, 10, 24.9 and 25 kg; no weight; a newer effective_from beats an older row; an override wins', async ({ page }) => {
    await page.goto('cdhub/');
    const r = await page.evaluate((rules) => {
      const at = (kg, today) => BLDCapacity.sizeForDog({ kg, rules, today }).size;
      return {
        edges: [9.9, 10, 24.9, 25].map((kg) => at(kg, '2026-11-18')),
        newer: at(11, '2026-11-18'), older: at(11, '2026-06-01'),          // medium from 10 (Nov row) vs 12 (Jan row)
        noWeight: BLDCapacity.sizeForDog({ rules, today: '2026-11-18' }),
        noWeightRange: BLDCapacity.sizeForDog({ sizeText: 'Pretend 17-22kg', rules, today: '2026-11-18' }).size,
        future: BLDCapacity.sizeForDog({ kg: 11, rules: rules.concat([{ rule_key: 'size_from_kg.medium', value: '15', effective_from: '2027-01-01', source: 'Pretend later' }]), today: '2026-11-18' }).size,
        override: BLDCapacity.sizeForDog({ id: 'x', kg: 5, rules: rules.concat([{ rule_key: 'size_override.x', value: 'large', effective_from: '2026-11-01' }]), today: '2026-11-18' }),
        backToWeight: BLDCapacity.sizeForDog({ id: 'x', kg: 5, rules: rules.concat([{ rule_key: 'size_override.x', value: 'large', effective_from: '2026-11-01' }, { rule_key: 'size_override.x', value: 'weight', effective_from: '2026-11-10' }]), today: '2026-11-18' }).size
      };
    }, RULES);
    expect(r.edges).toEqual(['small', 'medium', 'medium', 'large']);
    expect([r.newer, r.older]).toEqual(['medium', 'small']);
    expect(r.noWeight).toEqual({ size: '', from: '', kg: null });
    expect(r.noWeightRange).toBe('medium');
    expect(r.future).toBe('medium');   // a row not yet in force changes nothing
    expect(r.override).toEqual({ size: 'large', from: 'override', kg: 5 });
    expect(r.backToWeight).toBe('small');
  });

  test('kennel cards: size word only, colour from size_colour rows, no kg anywhere; no weight and no size prints none', async ({ page }) => {
    const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
    const CORS = { 'access-control-allow-origin': '*' };
    const ids = ['e1', 'e2', 'e3', 'e4', 'n1', 'n2', 'n3'];
    const tables = {
      area: [{ id: 'ar-a', code: 'Room A' }], requirement: [], area_access: [], area_capacity: [], litter: [],
      subject: [
        { id: 'e1', name: 'Pretend Nine Nine', sex: 'Female', size_band: '' },
        { id: 'e2', name: 'Pretend Ten', sex: 'Male', size_band: 'Pretend 17-22kg (medium)' },
        { id: 'e3', name: 'Pretend Twenty Four', sex: 'Female', size_band: '' },
        { id: 'e4', name: 'Pretend Twenty Five', sex: 'Male', size_band: 'Medium 17-22kg' },
        { id: 'n1', name: 'Pretend Typed Range', sex: 'Female', size_band: 'Medium 17-22kg' },
        { id: 'n2', name: 'Pretend Typed Word', sex: 'Female', size_band: 'large' },
        { id: 'n3', name: 'Pretend Nothing', sex: 'Male', size_band: '' }],
      weight: [{ subject_id: 'e1', performed_on: '2026-11-01', weight_kg: '9.9' }, { subject_id: 'e2', performed_on: '2026-11-01', weight_kg: '10' },
        { subject_id: 'e3', performed_on: '2026-11-01', weight_kg: '24.9' }, { subject_id: 'e4', performed_on: '2026-10-01', weight_kg: '9' },
        { subject_id: 'e4', performed_on: '2026-11-01', weight_kg: '25' }],
      occupancy: ids.map((id) => ({ subject_id: id, area_id: 'ar-a', moved_in: '2026-01-01' })),
      qr_tag: ids.map((id, i) => ({ tag: 'TAG' + 'ABCDEFG'[i] + 'XXXX', kind: 'subject', ref_id: id, active: 'true' })),
      breeding_rule: RULES, coat_colour: [], coat_pattern: [], nose_pigment: [], microchip: [], check_type: []
    };
    await page.route(SCRIPT, (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[JSON.parse(route.request().postData()).table] || [] } } });
    });
    await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
    await page.goto('cdhub/staff/print/');
    await page.getByRole('button', { name: 'Dog kennel cards' }).click();
    const card = (id) => page.locator('.dcard[data-dog="' + id + '"]');
    const want = { e1: ['small', 'Small', 'orange'], e2: ['medium', 'Medium', 'green'], e3: ['medium', 'Medium', 'green'], e4: ['large', 'Large', 'blue'],
      n1: ['medium', 'Medium', 'green'], n2: ['large', 'Large', 'blue'] };
    for (const [id, [key, word, colour]] of Object.entries(want)) {
      await expect(card(id).locator('[data-k="size"]')).toHaveAttribute('data-size', key);
      await expect(card(id).locator('[data-k="size"]')).toHaveText(word);
      await expect(card(id)).toHaveAttribute('style', new RegExp('--c:var\\(--sz-' + colour + ', ' + colour + '\\)'));
    }
    await expect(card('n3').locator('[data-k="size"]')).toHaveCount(0);   // no weight and no size typed: no size, never a guess
    await expect(page.locator('.sheet')).not.toContainText(/kg/i);
  });
});
