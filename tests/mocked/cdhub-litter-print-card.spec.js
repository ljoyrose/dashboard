// Litter print card in the kennel-card style (Lisa's "Dog Card Print-outs" v4): band in the dam's size colour,
// Born DD/MM/YY, Sire, Pups, Room, one large code. Only litters still here. Invented rows only.
const { test, expect } = require('../fixtures/job34/load');

test('print: litter cards look like kennel cards and list only litters still on site', async ({ page }) => {
  const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
  const CORS = { 'access-control-allow-origin': '*' };
  const tag = (ref, t, kind) => ({ tag: t, kind: kind || 'litter', ref_id: ref, active: 'true' });
  const tables = {
    area: [{ id: 'ar-a', code: 'Room A' }],
    requirement: [],
    subject: [
      { id: 'dam1', name: 'Pretend Dam', sex: 'Female', size_band: '10-25kg (medium)' },
      { id: 'sire1', name: 'Pretend Sire', sex: 'Male' },
      { id: 'p1', name: 'Pretend Pup A', birth_litter_id: 'lit-new' },
      { id: 'p2', name: 'Pretend Pup B', birth_litter_id: 'lit-new' },
      { id: 'p3', name: 'Pretend Pup Gone', birth_litter_id: 'lit-old' }
    ],
    subject_status: [{ subject_id: 'p3', state: 'Collected' }],
    litter: [
      { id: 'lit-old', dam_subject_id: 'dam1', sire_subject_id: 'sire1', born_on: '2024-03-01' },
      { id: 'lit-new', dam_subject_id: 'dam1', sire_subject_id: 'sire1', born_on: '2026-09-30' }
    ],
    breeding_rule: [{ rule_key: 'size_colour.medium', value: 'green' }],
    area_access: [], area_capacity: [],
    occupancy: [
      { subject_id: 'dam1', area_id: 'ar-a', moved_in: '2026-01-01' },
      { subject_id: 'p1', area_id: 'ar-a', moved_in: '2026-09-30' },
      { subject_id: 'p2', area_id: 'ar-a', moved_in: '2026-09-30' }
    ],
    qr_tag: [tag('lit-new', 'LLLLLLLL'), tag('lit-old', 'MMMMMMMM')]
  };
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[JSON.parse(route.request().postData()).table] || [] } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Litter cards' }).click();
  const card = page.locator('.dcard.lcard');
  await expect(card).toHaveCount(1);                                   // the old litter has no pup left on site
  await expect(card).toHaveAttribute('data-litter', 'lit-new');
  await expect(card.locator('.who b')).toHaveText('Litter of Pretend Dam');
  await expect(card.locator('[data-k="born"]')).toHaveText('Born30/09/26');
  await expect(card.locator('[data-k="Sire"] dd')).toHaveText('Pretend Sire');
  await expect(card.locator('[data-k="Pups"] dd')).toHaveText('2');
  await expect(card.locator('[data-k="Room"] dd')).toHaveText('Room A');
  await expect(card).toHaveAttribute('style', /--c:var\(--sz-green, green\)/);
  await expect(card.locator('.code svg')).toHaveCount(1);
  await expect(page.locator('.sheet')).toHaveClass(/\bper1\b/);
  await page.getByRole('button', { name: '2 per A4' }).click();
  await expect(page.locator('.sheet')).toHaveClass(/\blitters\b.*\bper2\b|\bper2\b.*\blitters\b/);
});
