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
    breeding_rule: [{ rule_key: 'size_colour.medium', value: 'green' }, { rule_key: 'link_kind.bff', value: 'BFFs', effective_from: '2026-01-01' }],
    subject_link: [{ subject_id: 'p1', other_subject_id: 'dam1', kind: 'bff', from_date: '2026-01-01' }],
    area_access: [], area_capacity: [],
    occupancy: [
      { subject_id: 'dam1', area_id: 'ar-a', moved_in: '2025-06-01', classification: 'Pretend Breeding Bitch' },
      { subject_id: 'dam1', area_id: 'ar-a', moved_in: '2026-01-01' },
      { subject_id: 'p1', area_id: 'ar-a', moved_in: '2026-09-30' },
      { subject_id: 'p2', area_id: 'ar-a', moved_in: '2026-09-30' }
    ],
    qr_tag: [tag('lit-new', 'LLLLLLLL'), tag('lit-old', 'MMMMMMMM'), tag('dam1', 'DDDDDDDD', 'subject'), tag('ar-a', 'RRRRRRRR', 'area')],
    coat_colour: [{ id: 'cc-1', name: 'Pretend Gold' }], coat_pattern: [{ id: 'cp-1', name: 'Parti' }], nose_pigment: [],
    microchip: [{ id: 'm1', subject_id: 'dam1', chip_number: '123456789012345' }],
    check_type: [
      { type_key: 'nails', label: 'Nails', target: 'dog', group: 'Grooming', every_days: '28', effective_from: '2026-01-01', active: 'true' },
      { type_key: 'ears', label: 'Ears', target: 'dog', group: 'Grooming', every_days: '28', effective_from: '2026-01-01', active: 'true' },
      { type_key: 'weigh', label: 'Weigh', target: 'dog', effective_from: '2026-01-01', active: 'true' },
      { type_key: 'old', label: 'Retired job', target: 'dog', effective_from: '2026-01-01', active: 'false' },
      { type_key: 'clean', label: 'Daily clean', target: 'area', every_days: '1', effective_from: '2026-01-01', active: 'true' },
      { type_key: 'deep', label: 'Deep clean', target: 'area', every_days: '7', effective_from: '2026-01-01', active: 'true' },
      { type_key: 'social', label: 'Socialisation', target: 'litter', frequency: 'daily', effective_from: '2026-01-01', active: 'true' }
    ]
  };
  tables.subject[0].coat_colour_id = 'cc-1'; tables.subject[0].coat_pattern_id = 'cp-1';
  tables.subject[0].photo = 'FAKEphotoFileId123';
  await page.route(/^https:\/\/drive\.google\.com\/thumbnail/, (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
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
  await expect(card.locator('[data-k="jobs"] li')).toHaveText(['Socialisationdaily']);
  // kennel card: Colour from the lookup rows, Microchip in threes, the job strip by group (retired job left out)
  await page.getByRole('button', { name: 'Dog kennel cards' }).click();
  const dam = page.locator('.dcard[data-dog="dam1"]');
  await expect(dam.locator('[data-k="Colour"] dd')).toHaveText('Pretend Gold parti');
  await expect(dam.locator('[data-k="chip"] b')).toHaveText('123 456 789 012 345');
  await expect(dam.locator('[data-k="BFFs:"] dd')).toHaveText('Pretend Pup A');   // BFFs from the link rows, read both ways
  // Lisa 13 Nov 2026: the print checks name, size, classification, microchip, photo, colour and DOB
  await expect(dam.locator('[data-k="Class"] dd')).toHaveText('Pretend Breeding Bitch');   // kept from the older row; the move row is blank
  await expect(dam.locator('[data-k="photo"] img')).toHaveAttribute('src', /thumbnail\?id=FAKEphotoFileId123/);
  await expect(dam.locator('[data-k="jobs"] .job')).toHaveText(['Grooming', 'Weigh']);
  await expect(page.locator('.dcard[data-dog="sire1"] [data-k="chip"]')).toHaveCount(0);
  // room sign: room jobs and how often
  await page.getByRole('button', { name: 'Room signs' }).click();
  await expect(page.locator('.rcard [data-k="jobs"] li')).toHaveText(['Daily cleandaily', 'Deep cleanweekly']);
  // no address on any print-out (Lisa 13 Nov 2026): no printed text holds the site address, and the page margin is 0 so the
  // browser has no room for its own header and footer (which print the page address)
  const origin = new URL(page.url()).origin;
  for (const b of ['Room signs', 'Dog kennel cards', 'Litter cards']) {
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('button', { name: b }).click();
    await page.emulateMedia({ media: 'print' });
    expect(await page.locator('.sheet').innerText()).not.toContain(origin);
    expect(await page.locator('.sheet').innerText()).not.toMatch(/https?:|www\./);
  }
  const margins = await page.evaluate(() => [].concat(...[...document.styleSheets].map((sh) => { try { return [...sh.cssRules]; } catch (e) { return []; } }))
    .flatMap((r) => (r.cssRules ? [...r.cssRules] : [r])).filter((r) => r.type === 6).map((r) => r.style.margin));
  expect(margins.length).toBeGreaterThan(0);
  for (const m of margins) expect(m).toMatch(/^0(px)?$/);
});
