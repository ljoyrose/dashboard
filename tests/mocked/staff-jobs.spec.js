// Job screen on the staff page. Pretend rooms, dogs, tags and jobs; fake code and fake save address only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const J = (key, label, target, extra) => Object.assign({ id: 'cty-' + key, type_key: key, label, target, active: 'true', effective_from: '2026-01-01', asks_outcome: 'true', every_days: '' }, extra || {});
const TYPES = [
  J('nails', 'Nails', 'dog', { every_days: '28', group: 'Grooming' }),
  J('ears', 'Ears', 'dog', { every_days: '28', group: 'Grooming' }),
  J('weigh', 'Weigh', 'dog', { asks_amount: 'true', amount_unit: 'kg' }),
  J('clean', 'Room clean', 'area', { every_days: '1' }),
  J('bowls', 'Bowls', 'none', { every_days: '1', site_scope: 'one_line' }),
  J('walk', 'Walk', 'none', { every_days: '1', site_scope: 'per_dog', not_in_areas: 'none' }),
  J('toys', 'Toys', 'none'),
  J('exercise', 'Exercise', 'area', { every_days: '1', site_scope: 'per_dog' }),
  J('report', 'Report', 'optional', { note_label: 'What happened?' })
];
const TABLES = {
  area: [{ id: 'area-1', code: 'R1' }], subject: [{ id: 'dog-1', name: 'Pretend A' }, { id: 'dog-2', name: 'Pretend B' }],
  occupancy: [{ subject_id: 'dog-1', area_id: 'area-1', moved_in: '2026-10-01' }, { subject_id: 'dog-2', area_id: 'area-1', moved_in: '2026-10-01' }],
  subject_status: [], check_type: TYPES, check_log: [], area_capacity: [], area_access: [], litter: [], capacity_setting: [],
  qr_tag: [{ tag: 'DOG2TAG2', kind: 'subject', ref_id: 'dog-1', active: 'true' }, { tag: 'ROOMTAG2', kind: 'area', ref_id: 'area-1', active: 'true' }, { tag: 'SITETAG2', kind: 'site', ref_id: 'site', active: 'true' }]
};

async function setup(page, over) {
  const data = Object.assign({}, TABLES, over || {}), sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'check_log', on: true, mode: 'direct' }, { key: 'occupancy', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (String(b.action).indexOf('read') === 0) {
      if (b.table && !data[b.table]) return route.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'off' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: data[b.table] || [], tables: data } } });
    }
    sent.push(b);
    const site = b.action === 'add_site' && b.fields.dog_ids;
    return route.fulfill({ headers: CORS, json: { ok: true, result: Object.assign({ status: 'saved', id: 'clg-' + sent.length }, site ? { saved: 2, left_out: { isolation: 1, no_room: 0, off_site: 0, repeat: 0 } } : {}) } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  return sent;
}

test('a dog scan shows that dog\'s jobs, groups them, and one tap saves as scanned', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await expect(page.getByRole('heading', { name: 'Pretend A' })).toBeVisible();
  await expect(page.locator('[data-job="clean"]')).toHaveCount(0);
  await page.locator('[data-group="Grooming"]').click();
  await page.getByRole('button', { name: 'Done: Nails' }).click();
  await expect(page.locator('[data-job="nails"] .done-line')).toContainText(/Done \d\d:\d\d/);
  await expect(page.getByRole('button', { name: 'Done: Nails' })).toHaveClass(/is-done/);
  expect(sent[0]).toMatchObject({ table: 'check_log', action: 'add', fields: { check_type_id: 'cty-nails', subject_id: 'dog-1', outcome: 'ok', how_recorded: 'scanned' } });
  await expect(page.locator('[data-job="nails"] .ds')).toHaveText(/^Next \d{1,2} [A-Z][a-z]{2} \d{4}$/);   // date: "2 Mar 2026"
});

test('a job that asks for an amount opens its field first; a problem needs a note', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.getByRole('button', { name: 'Done: Weigh' }).click();
  expect(sent).toHaveLength(0);
  await page.locator('[data-job="weigh"]').getByLabel('Amount (kg)').fill('21.5');
  await page.getByRole('button', { name: 'Done: Weigh' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].fields.amount).toBe('21.5');
  const card = page.locator('[data-job="ears"]');
  await page.locator('[data-group="Grooming"]').click();
  await expect(page.getByRole('button', { name: 'Problem: Ears' })).toHaveText('Problem/Note?');
  await page.getByRole('button', { name: 'Problem: Ears' }).click();
  await expect(card.getByLabel('Note')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Not done' })).toBeVisible();
  await card.getByRole('button', { name: 'Concern' }).click();
  await expect(card.locator('.done-line.bad')).toContainText('Say briefly');
  await card.getByRole('button', { name: 'Not done' }).click();
  await expect(card.locator('.done-line.bad')).toContainText('Say briefly');
  expect(sent).toHaveLength(1);
});

test('a room scan shows room jobs, with Move dogs a tap away', async ({ page }) => {
  await setup(page);
  await page.goto('cdhub/staff/#s/ROOMTAG2');
  await expect(page.locator('[data-job="clean"]')).toBeVisible();
  await page.getByRole('button', { name: 'Move dogs' }).click();
  await expect(page.getByText('Now scan each dog card')).toBeVisible();
});

test('while a room is being filled, a scan keeps moving dogs', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => localStorage.setItem('bld.move.room', JSON.stringify({ areaId: 'area-1', label: 'R1', at: Date.now(), added: [] })));
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await expect(page.locator('[data-job]')).toHaveCount(0);
  await expect(page.locator('#screen')).toContainText('R1');
});

test('no job rows yet: a scan goes to Move dogs as before', async ({ page }) => {
  await setup(page, { check_type: [] });
  await page.goto('cdhub/staff/#s/ROOMTAG2');
  await expect(page.getByText('Now scan each dog card')).toBeVisible();
});

test('site code: only what is due, bowls one line, a dog job lists every dog ticked and sends them', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/SITETAG2');
  await expect(page.locator('[data-job="toys"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Yes, done: Bowls' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].action).toBe('add_site');
  expect(sent[0].fields.dog_ids).toBeUndefined();
  await page.getByRole('button', { name: 'Yes, done: Walk' }).click();
  const walk = page.locator('[data-job="walk"]');
  await expect(walk.getByRole('checkbox')).toHaveCount(2);
  await expect(walk.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Yes, done: Walk' }).click();
  await expect(walk.getByText('Tick a dog.')).toBeVisible();
  expect(sent).toHaveLength(1);
  await walk.getByRole('button', { name: 'Select all' }).click();
  await expect(walk.getByRole('checkbox', { checked: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Yes, done: Walk' }).click();
  await expect(page.getByText('Left out: 1.')).toBeVisible();
  await expect(page.locator('[data-job="walk"] .done-line')).toContainText('2 of 2 dogs');
  expect(sent[1].fields.dog_ids).toBe('dog-1|dog-2');
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.locator('[data-job="toys"]')).toBeVisible();
});

test('Problem (was Report) is on every screen and carries the dog just scanned', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await expect(page.getByRole('heading', { name: 'Pretend A' })).toBeVisible();
  await page.locator('#tabs').getByRole('button', { name: 'Problem' }).click();
  await expect(page.getByLabel('Dog')).toHaveValue('dog-1');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Say what happened.')).toBeVisible();
  await page.getByLabel('What happened?').fill('Pretend note');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Sent.')).toBeVisible();
  expect(sent[0]).toMatchObject({ action: 'add', fields: { check_type_id: 'cty-report', subject_id: 'dog-1', outcome: 'recorded', note: 'Pretend note' } });
});

test('jobs are listed A-Z, with a group where its name falls, whatever is late', async ({ page }) => {
  await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await expect(page.locator('[data-group="Grooming"]')).toBeVisible();
  await expect(page.locator('.job .nm')).toHaveText(['Grooming', 'Walk', 'Weigh']);
  await page.goto('cdhub/staff/#s/SITETAG2');
  await expect(page.locator('.job .nm')).toHaveText(['Bowls', 'Walk']);
});

test('a room job about dogs lists the room\'s dogs ticked and saves only those left ticked', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/ROOMTAG2');
  const card = page.locator('[data-job="exercise"]');
  await expect(card.getByRole('checkbox')).toHaveCount(2);
  await card.getByRole('checkbox', { name: 'Pretend B' }).uncheck();
  await card.getByRole('button', { name: /^Done/ }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].action).toBe('add_site');
  expect(sent[0].fields.dog_ids).toBe('dog-1');
  expect(sent[0].fields.area_id).toBe('area-1');
  expect(sent[0].fields.how_recorded).toBe('scanned');
});

test('a scanned room has a Temperature button that opens the temperature screen', async ({ page }) => {
  await setup(page);
  await page.goto('cdhub/staff/#s/ROOMTAG2');
  await page.getByRole('button', { name: 'Move dogs' }).click();
  await page.getByRole('button', { name: 'Temperature' }).click();
  await expect(page).toHaveURL(/#m\/temperature$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bld.move.room')).areaId)).toBe('area-1');
});

test('a thermometer scan opens the temperature round at that thermometer, and saves nothing', async ({ page }) => {
  const sent = await setup(page, { qr_tag: TABLES.qr_tag.concat([{ tag: 'THERMO23', kind: 'thermometer', ref_id: 'thm-1', active: 'true' }]) });
  await page.goto('cdhub/staff/#s/THERMO23');
  await expect(page).toHaveURL(/#m\/temperature$/);
  const t = await page.evaluate(() => JSON.parse(localStorage.getItem('bld.temp.thermometer')));
  expect(t.thermometerId).toBe('thm-1');
  expect(Math.abs(Date.now() - t.at)).toBeLessThan(60000);
  expect(sent).toHaveLength(0);
});

test('a litter code opens that litter\'s jobs and saves against the litter', async ({ page }) => {
  const sent = await setup(page, {
    check_type: TYPES.concat([J('socialise', 'Socialisation', 'litter', { every_days: '1' })]),
    litter: [{ id: 'lit-1', dam_subject_id: 'dog-1' }],
    qr_tag: TABLES.qr_tag.concat([{ tag: 'LITTAG22', kind: 'litter', ref_id: 'lit-1', active: 'true' }])
  });
  await page.goto('cdhub/staff/#s/LITTAG22');
  await expect(page.getByRole('heading', { name: 'Litter of Pretend A' })).toBeVisible();
  await expect(page.locator('[data-job]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Done: Socialisation' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ action: 'add', fields: { check_type_id: 'cty-socialise', litter_id: 'lit-1', outcome: 'ok', how_recorded: 'scanned' } });
  expect(sent[0].fields.subject_id).toBeUndefined();
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await expect(page.locator('[data-job="socialise"]')).toHaveCount(0);
});

test('a litter code with no litter jobs goes on to Move dogs as before', async ({ page }) => {
  await setup(page, { litter: [{ id: 'lit-1', dam_subject_id: 'dog-1' }], qr_tag: TABLES.qr_tag.concat([{ tag: 'LITTAG22', kind: 'litter', ref_id: 'lit-1', active: 'true' }]) });
  await page.goto('cdhub/staff/#s/LITTAG22');
  await expect(page.locator('[data-job]')).toHaveCount(0);
  await expect(page.getByText('Scan a room sign first')).toBeVisible();
});

test('a whole-site clean ticks each room\'s daily clean, but never an isolation room', async ({ page }) => {
  const types = TYPES.concat([J('site_clean', 'Whole site cleaned', 'none', { every_days: '1', site_scope: 'one_line', includes: 'clean', not_in_areas: 'area-iso' })]);
  const today = new Date().toISOString().slice(0, 10);
  const log = { id: 'clg-9', check_type_id: 'cty-site_clean', outcome: 'ok', how_recorded: 'site_tap', taken_at: today + 'T09:00:00Z' };
  const over = {
    check_type: types, check_log: [log], area: [{ id: 'area-1', code: 'R1' }, { id: 'area-iso', code: 'R2' }],
    qr_tag: TABLES.qr_tag.concat([{ tag: 'ISOTAG22', kind: 'area', ref_id: 'area-iso', active: 'true' }])
  };
  await setup(page, over);
  await page.goto('cdhub/staff/#s/ROOMTAG2');
  await expect(page.locator('[data-job="clean"] .ds')).toContainText('Whole site cleaned');
  await expect(page.locator('[data-job="clean"] .ds')).toContainText('Next');
  await page.goto('cdhub/staff/#s/ISOTAG22');
  await expect(page.locator('[data-job="clean"] .ds')).toHaveText('Due');
});

test('a job with form questions opens its form, needs the required answers, and sends them with the record', async ({ page }) => {
  const F = (field_key, label, kind, extra) => Object.assign({ id: 'cfd-' + field_key, type_key: 'weigh', field_key, label, kind, required: 'false', sort: '', active: 'true', effective_from: '2026-01-01' }, extra || {});
  const sent = await setup(page, { check_field: [
    F('stool', 'Stool', 'choice', { choices: 'Normal|Loose', required: 'true', sort: '1' }),
    F('eating', 'Eating well', 'yesno', { sort: '2' }),
    F('old', 'Old question', 'text', { active: 'false' }),
    F('walk', 'Walk', 'text', { type_key: 'walk' })
  ] });
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  const card = page.locator('[data-job="weigh"]');
  await page.getByRole('button', { name: 'Done: Weigh' }).click();
  await expect(card.locator('[data-field]')).toHaveCount(2);
  await expect(card.locator('[data-field="old"]')).toHaveCount(0);
  await card.getByLabel('Amount (kg)').fill('21.5');
  await page.getByRole('button', { name: 'Done: Weigh' }).click();
  await expect(card.getByText('This is needed: Stool.')).toBeVisible();
  expect(sent).toHaveLength(0);
  await card.getByLabel('Stool').selectOption('Loose');
  await page.getByRole('button', { name: 'Done: Weigh' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].action).toBe('add');
  expect(sent[0].values).toEqual({ stool: 'Loose' });
  await page.goto('cdhub/staff/#s/SITETAG2');
  await page.getByRole('button', { name: 'Yes, done: Walk' }).click();
  await expect(page.locator('[data-job="walk"] [data-field]')).toHaveCount(0);
  await page.locator('[data-job="walk"]').getByRole('button', { name: 'Select all' }).click();
  await page.getByRole('button', { name: 'Yes, done: Walk' }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1].values).toBeUndefined();
});

test('a room job set for one room only shows on that room\'s scan', async ({ page }) => {
  await setup(page, { check_type: TYPES.concat([J('iso_clean', 'Isolation clean', 'area', { every_days: '1', only_in_areas: 'area-iso' })]),
    qr_tag: TABLES.qr_tag.concat([{ tag: 'ISOTAG22', kind: 'area', ref_id: 'area-iso', active: 'true' }]), area: [{ id: 'area-1', code: 'R1' }, { id: 'area-iso', code: 'R2' }] });
  await page.goto('cdhub/staff/#s/ROOMTAG2');
  await expect(page.locator('[data-job="clean"]')).toBeVisible();
  await expect(page.locator('[data-job="iso_clean"]')).toHaveCount(0);
  await page.goto('cdhub/staff/#s/ISOTAG22');
  await expect(page.locator('[data-job="iso_clean"]')).toBeVisible();
});

test('a whole-site dog job: one dog not right is flagged on its own from the site list', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/SITETAG2');
  const card = page.locator('[data-job="walk"]');
  await card.getByRole('button', { name: 'Problem: Walk' }).click();
  await card.getByRole('checkbox', { name: 'Pretend B' }).check();
  await card.getByLabel('Note').fill('Pretend note');
  await card.getByRole('button', { name: 'Concern' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ action: 'add_site', fields: { dog_ids: 'dog-2', outcome: 'concern', note: 'Pretend note' } });
});

test('a whole-site dog job can be done dog by dog: on a dog scan and on a room scan', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.getByRole('button', { name: 'Done: Walk' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ action: 'add_site', fields: { check_type_id: 'cty-walk', dog_ids: 'dog-1' } });
  await expect(page.locator('[data-job="walk"] .ds')).toContainText('Next');
  await page.goto('cdhub/staff/#s/ROOMTAG2');
  const card = page.locator('[data-job="walk"]');
  await expect(card.getByRole('checkbox')).toHaveCount(2);
  await card.getByRole('checkbox', { name: 'Pretend A' }).check();
  await card.getByRole('button', { name: 'Select all' }).click();
  await card.getByRole('checkbox', { name: 'Pretend A' }).uncheck();
  await card.getByRole('button', { name: 'Done: Walk' }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1]).toMatchObject({ action: 'add_site', fields: { dog_ids: 'dog-2' } });
});

test('a whole-site dog job: every dog starts unticked; Select all skips a dog already done today', async ({ page }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  await setup(page, { check_log: [{ id: 'clg-1', check_type_id: 'cty-walk', subject_id: 'dog-1', outcome: 'ok', how_recorded: 'site_tap', taken_at: today + 'T09:00:00Z' }] });
  await page.goto('cdhub/staff/#s/ROOMTAG2');
  const card = page.locator('[data-job="walk"]');
  await expect(card.getByRole('checkbox', { name: /Pretend A/ })).not.toBeChecked();
  await expect(card.getByRole('checkbox', { name: 'Pretend B' })).not.toBeChecked();
  await card.getByRole('button', { name: 'Select all' }).click();
  await expect(card.getByRole('checkbox', { name: 'Pretend B' })).toBeChecked();
  await expect(card.getByRole('checkbox', { name: /Pretend A/ })).not.toBeChecked();
  await expect(card.locator('.dog-done svg')).toHaveCount(1);
  await expect(card.locator('.dog-at')).toHaveText(/^\d\d:\d\d$/);
  await expect(card.locator('.done-line')).toContainText('1 of 2 dogs');
});

test('a tick only once received: Problem shows its result, a refusal shows a red line and the button stays', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.locator('[data-group="Grooming"]').click();
  const ears = page.locator('[data-job="ears"]');
  await page.getByRole('button', { name: 'Problem: Ears' }).click();
  await ears.getByLabel('Note').fill('Pretend note');
  await ears.getByRole('button', { name: 'Concern' }).click();
  await expect(ears.locator('.done-line')).toContainText('Concern noted');
  await page.route(SCRIPT, (route) => {
    const b = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : {};
    if (b.action !== 'add') return route.fallback();
    return route.fulfill({ headers: CORS, json: { ok: false, code: 'INVALID', message: 'Pretend refusal.' } });
  });
  const nails = page.locator('[data-job="nails"]');
  await page.getByRole('button', { name: 'Done: Nails' }).click();
  await expect(nails.locator('.done-line.bad')).toContainText('Not saved: Pretend refusal.');
  await expect(page.getByRole('button', { name: 'Done: Nails' })).not.toHaveClass(/is-done/);
  expect(sent).toHaveLength(1);
});

test('every tap shows Saving straight away, with the button off until the reply', async ({ page }) => {
  const sent = await setup(page);
  let release;
  const held = new Promise((r) => { release = r; });
  await page.goto('cdhub/staff/#s/SITETAG2');
  await page.route(SCRIPT, async (route) => {
    const b = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : {};
    if (b.action !== 'add_site') return route.fallback();
    await held;
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'clg-held' } } });
  });
  const bowls = page.locator('[data-job="bowls"]');
  await page.getByRole('button', { name: 'Yes, done: Bowls' }).click();
  await expect(bowls.locator('.done-line')).toContainText('Saving...');
  await expect(page.getByRole('button', { name: 'Yes, done: Bowls' })).toBeDisabled();
  release();
  await expect(bowls.locator('.done-line')).toContainText(/Done \d\d:\d\d/);
  expect(sent).toHaveLength(0);
});

test('a check the screen refuses before sending still shows on the card', async ({ page }) => {
  await setup(page);
  await page.goto('cdhub/staff/#s/SITETAG2');
  const walk = page.locator('[data-job="walk"]');
  await page.getByRole('button', { name: 'Yes, done: Walk' }).click();
  await page.getByRole('button', { name: 'Yes, done: Walk' }).click();
  await expect(walk.locator('.done-line.bad')).toContainText('Tick a dog.');
});

test('Note on a job not done yet saves it as done with the note, shown under the tick', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.locator('[data-group="Grooming"]').click();
  const ears = page.locator('[data-job="ears"]');
  await page.getByRole('button', { name: 'Problem: Ears' }).click();
  await ears.getByRole('button', { name: 'Note', exact: true }).click();
  await expect(ears.locator('.done-line.bad')).toContainText('Write the note.');
  expect(sent).toHaveLength(0);
  await ears.getByLabel('Note').fill('Pretend explanation');
  await ears.getByRole('button', { name: 'Note', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ action: 'add', fields: { check_type_id: 'cty-ears', outcome: 'ok', note: 'Pretend explanation' } });
  await expect(ears.locator('.done-line')).toContainText(/Done \d\d:\d\d/);
  await expect(ears.locator('.done-note')).toHaveText('Pretend explanation');
  // already done today: a second note is its own row pointing at the done one, never a second done
  await page.getByRole('button', { name: 'Problem: Ears' }).click();
  await ears.getByLabel('Note').fill('Pretend second note');
  await ears.getByRole('button', { name: 'Note', exact: true }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1]).toMatchObject({ action: 'add', fields: { check_type_id: 'cty-ears', outcome: 'note', note: 'Pretend second note', note_for_id: 'clg-1', subject_id: 'dog-1' } });
  await expect(ears.locator('.done-note')).toHaveText('Pretend explanation\nPretend second note');
});

test('a note on a whole-site job already done today is one plain row, not a whole-site tap', async ({ page }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const sent = await setup(page, { check_log: [{ id: 'clg-7', check_type_id: 'cty-bowls', outcome: 'ok', how_recorded: 'site_tap', taken_at: today + 'T09:00:00Z' }] });
  await page.goto('cdhub/staff/#s/SITETAG2');
  await page.getByRole('button', { name: 'More' }).click();
  const bowls = page.locator('[data-job="bowls"]');
  await page.getByRole('button', { name: 'Problem: Bowls' }).click();
  await bowls.getByLabel('Note').fill('Pretend note');
  await bowls.getByRole('button', { name: 'Note', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ action: 'add', fields: { outcome: 'note', note_for_id: 'clg-7' } });
  expect(sent[0].fields.dog_ids).toBeUndefined();
  await expect(bowls.locator('.done-note')).toHaveText('Pretend note');
});

test('a save refused as a repeat says so once, in plain words', async ({ page }) => {
  await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.route(SCRIPT, (route) => {
    const b = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : {};
    if (b.action !== 'add') return route.fallback();
    return route.fulfill({ headers: CORS, json: { ok: false, code: 'DUPLICATE', message: 'This looks like the same entry as one already saved.' } });
  });
  const weigh = page.locator('[data-job="weigh"]');
  await page.getByRole('button', { name: 'Done: Weigh' }).click();
  await weigh.getByLabel('Amount (kg)').fill('21.5');
  await page.getByRole('button', { name: 'Done: Weigh' }).click();
  await expect(weigh.locator('.done-line.bad')).toContainText('Already saved a moment ago');
  await expect(weigh.getByText('Already saved a moment ago')).toHaveCount(1);
  await expect(weigh.getByText('Saving...')).toHaveCount(0);
});

test('Part done needs a note, saves as part_done and shows on the card, not as done', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.locator('[data-group="Grooming"]').click();
  const ears = page.locator('[data-job="ears"]');
  await page.getByRole('button', { name: 'Problem: Ears' }).click();
  await ears.getByRole('button', { name: 'Part done' }).click();
  await expect(ears.locator('.done-line.bad')).toContainText('Say briefly');
  expect(sent).toHaveLength(0);
  await ears.getByLabel('Note').fill('Pretend: one ear only');
  await ears.getByRole('button', { name: 'Part done' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ action: 'add', fields: { outcome: 'part_done', note: 'Pretend: one ear only' } });
  await expect(ears.locator('.done-line.flag')).toContainText('Part done');
  await expect(ears.locator('.ds')).toHaveText('Due');
});

test('when this code cannot read past records, the list says so instead of a silent Due', async ({ page }) => {
  await setup(page, { check_log: undefined });
  await page.goto('cdhub/staff/#s/SITETAG2');
  await expect(page.locator('[data-no-history]')).toContainText('cannot read past records');
});

test('with past records readable there is no warning', async ({ page }) => {
  await setup(page);
  await page.goto('cdhub/staff/#s/SITETAG2');
  await expect(page.locator('[data-job="bowls"]')).toBeVisible();
  await expect(page.locator('[data-no-history]')).toHaveCount(0);
});

test('Earlier (late entry) saves the real day and time, ticks the card with that day, and refuses a future day', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.locator('[data-group="Grooming"]').click();
  const ears = page.locator('[data-job="ears"]');
  const london = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);
  const yesterday = london(new Date(Date.now() - 86400000)), tomorrow = london(new Date(Date.now() + 86400000));
  await page.getByRole('button', { name: 'Earlier: Ears' }).click();
  await expect(page.getByText('From paper')).toHaveCount(0);
  // a future day is refused on the phone, before anything is sent
  await ears.getByLabel('Day done').evaluate((el, v) => { el.removeAttribute('max'); el.value = v; }, tomorrow);
  await ears.getByRole('button', { name: 'Done: Ears' }).click();
  await expect(ears.locator('.done-line.bad')).toContainText('earlier day');
  expect(sent).toHaveLength(0);
  await ears.getByLabel('Day done').fill(yesterday);
  await ears.getByLabel('Time done (optional)').fill('07:30');
  await ears.getByRole('button', { name: 'Done: Ears' }).click();
  await expect.poll(() => sent.length).toBe(1);
  const f = sent[0].fields;
  expect(f.how_recorded).not.toBe('scanned');
  expect(london(new Date(f.happened_at))).toBe(yesterday);
  expect(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(new Date(f.happened_at))).toBe('07:30');
  await expect(ears.locator('.done-line.good')).toContainText('07:30');
  await expect(ears.locator('.done-line.good')).toContainText(/\d{1,2} [A-Z][a-z]{2}/);
});
