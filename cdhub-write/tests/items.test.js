'use strict';
/**
 * 14 Nov 2026, ITEMS (item checks brick, decision 13 Nov option A): BLD-items and BLD-item_kinds, item tests as
 * check_type rows (target item, item_kind), check_log.item_id, number questions with unit and dated limits, and a
 * form judged by the questions in force on the record's own day (an Earlier entry).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const TYPE_H = ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency', 'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas', 'item_kind'];
const LOG_H = ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at', 'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id', 'note_for_id', 'item_id'];
const FIELD_H = ['id', 'tenant_id', 'type_key', 'field_key', 'label', 'kind', 'choices', 'required', 'sort', 'active', 'effective_from', 'set_at', 'set_by', 'unit', 'limit_low', 'limit_high', 'source'];
const VALUE_H = ['id', 'tenant_id', 'check_log_id', 'check_field_id', 'field_key', 'value'];
const ITEM_H = ['id', 'tenant_id', 'item_no', 'name', 'kind_key', 'make', 'model', 'serial_no', 'size', 'made_on', 'expires_on', 'photo', 'note', 'corrects_id', 'created_at', 'created_by'];
const KIND_H = ['id', 'tenant_id', 'kind_key', 'label', 'source', 'set_by', 'set_on'];
const LINK_H = ['id', 'tenant_id', 'from_table', 'from_id', 'role', 'to_table', 'to_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'];
const NOW = Date.UTC(2026, 10, 14, 10, 0, 0);

const env0 = () => {
  const env = standardEnv({ nowMs: NOW, props: { TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true', TABLE_ON_check_field: 'true', TABLE_ON_check_value: 'true', TABLE_ON_items: 'true', TABLE_ON_item_kinds: 'true', TABLE_ON_links: 'true' } });
  env.addFile('BLD-check_type.csv', fx.headerOnly(TYPE_H));
  env.addFile('BLD-check_log.csv', fx.headerOnly(LOG_H));
  env.addFile('BLD-check_field.csv', fx.headerOnly(FIELD_H));
  env.addFile('BLD-check_value.csv', fx.headerOnly(VALUE_H));
  env.addFile('BLD-items.csv', fx.headerOnly(ITEM_H));
  env.addFile('BLD-item_kinds.csv', fx.headerOnly(KIND_H));
  env.addFile('BLD-links.csv', fx.headerOnly(LINK_H));
  return env;
};
const recs = (env, title) => { const f = env.file(title)[0];
  const [h, ...rows] = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === '')); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || '']))); };
const owner = (env, table, fields) => save(env, req(env, { code: env.codes.owner, table, fields }));
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r.result.id; };
const kind = (env, key) => ok(owner(env, 'item_kinds', { kind_key: key, label: key, source: 'test' }));
const item = (env, no, k, extra) => ok(owner(env, 'items', Object.assign({ item_no: no, name: 'Kettle', kind_key: k }, extra || {})));

function setup() {
  const env = env0();
  kind(env, 'appliance_class_1');
  kind(env, 'extinguisher_co2');
  const kettle = item(env, '04', 'appliance_class_1');
  const co2 = item(env, 'EXT-03', 'extinguisher_co2', { name: 'CO2 2.2 kg' });
  const pat = ok(owner(env, 'check_type', { type_key: 'pat_class_1', label: 'PAT Class I', target: 'item', item_kind: 'appliance_class_1', every_days: '365', evidence: 'optional', effective_from: '2025-01-01' }));
  return { env, kettle, co2, pat };
}

test('items: the owner adds kinds and items; staff cannot; an item needs a known kind', () => {
  const env = env0();
  kind(env, 'appliance_class_1');
  assert.equal(save(env, req(env, { code: env.codes.staff, table: 'items', fields: { item_no: '01', name: 'Microwave', kind_key: 'appliance_class_1' } })).ok, false);
  const r = owner(env, 'items', { item_no: '01', name: 'Microwave', kind_key: 'nope' });
  assert.equal(r.ok, false);
  assert.match(JSON.stringify(r), /No kind with that name/);
  const id = item(env, '01', 'appliance_class_1', { name: 'Microwave' });
  const row = recs(env, 'BLD-items.csv')[0];
  assert.equal(row.id, id);
  assert.equal(row.name, 'Microwave');
  assert.ok(row.created_at && row.created_by, 'stamped');
});

test('items: a change is a new row pointing at the first row, never at a change', () => {
  const env = env0();
  kind(env, 'appliance_class_1');
  const first = item(env, '05', 'appliance_class_1', { name: 'Fridge' });
  const second = item(env, '05', 'appliance_class_1', { name: 'Fridge (staff room)', corrects_id: first });
  const bad = owner(env, 'items', { item_no: '05', name: 'Fridge 3', kind_key: 'appliance_class_1', corrects_id: second });
  assert.equal(bad.ok, false);
  assert.match(JSON.stringify(bad), /first row/);
  assert.equal(recs(env, 'BLD-items.csv').length, 2);
});

test('check_type: item_kind is only for an item test', () => {
  const env = env0();
  const r = owner(env, 'check_type', { type_key: 'bowls', label: 'Bowls', target: 'area', item_kind: 'appliance_class_1', effective_from: '2026-01-01' });
  assert.equal(r.ok, false);
  assert.match(JSON.stringify(r), /Only for an item test/);
});

test('check_log: an item test names an item of its kind; other jobs never name an item', () => {
  const { env, kettle, co2, pat } = setup();
  const none = save(env, req(env, { code: env.codes.owner, table: 'check_log', fields: { check_type_id: pat, outcome: 'ok' } }));
  assert.match(JSON.stringify(none), /Say which item/);
  const wrong = save(env, req(env, { code: env.codes.owner, table: 'check_log', fields: { check_type_id: pat, item_id: co2, outcome: 'ok' } }));
  assert.match(JSON.stringify(wrong), /not for that kind of item/);
  const good = save(env, req(env, { code: env.codes.owner, table: 'check_log', fields: { check_type_id: pat, item_id: kettle, outcome: 'ok', happened_at: '2025-05-28T11:00:00Z', how_recorded: 'typed', confirm_unusual: 'yes' } }));
  assert.equal(good.ok, true, JSON.stringify(good));
  assert.equal(recs(env, 'BLD-check_log.csv')[0].item_id, kettle);
  const room = ok(owner(env, 'check_type', { type_key: 'bowls', label: 'Bowls', target: 'none', effective_from: '2026-01-01' }));
  const stray = save(env, req(env, { code: env.codes.owner, table: 'check_log', fields: { check_type_id: room, item_id: kettle, outcome: 'ok' } }));
  assert.match(JSON.stringify(stray), /Only an item test names an item/);
});

test('check_log: the same item twice is a repeat; two items are not', () => {
  const { env, kettle, pat } = setup();
  const other = item(env, '17', 'appliance_class_1');
  const one = (id) => save(env, req(env, { code: env.codes.owner, table: 'check_log', fields: { check_type_id: pat, item_id: id, outcome: 'ok' } }));
  assert.equal(one(kettle).ok, true);
  assert.equal(one(other).ok, true, 'a second item is its own record');
  assert.equal(one(kettle).ok, false, 'the same item again is a repeat');
});

test('check_field: a number question has a unit and limits; limits need numbers in order; others have none', () => {
  const { env } = setup();
  const f = (extra) => owner(env, 'check_field', Object.assign({ type_key: 'pat_class_1', field_key: 'earth_bond', label: 'Earth bond', kind: 'number', effective_from: '2025-01-01' }, extra));
  assert.match(JSON.stringify(f({ limit_high: 'low' })), /Type a number/);
  assert.match(JSON.stringify(f({ limit_low: '5', limit_high: '1' })), /cannot be below/);
  assert.match(JSON.stringify(f({ kind: 'text', unit: 'Ω' })), /Only a number question has a unit/);
  ok(f({ unit: 'Ω', limit_high: '0.1', source: 'G A Fire certificate 28 May 2025' }));
  const row = recs(env, 'BLD-check_field.csv')[0];
  assert.equal(row.unit, 'Ω');
  assert.equal(row.limit_high, '0.1');
  assert.equal(row.source, 'G A Fire certificate 28 May 2025');
});

test('forms: an Earlier entry is judged by the questions in force on its own day', () => {
  const { env, kettle, pat } = setup();
  ok(owner(env, 'check_field', { type_key: 'pat_class_1', field_key: 'insulation', label: 'Insulation', kind: 'number', unit: 'MΩ', limit_low: '1', effective_from: '2025-01-01' }));
  ok(owner(env, 'check_field', { type_key: 'pat_class_1', field_key: 'rcd_trip', label: 'RCD trip', kind: 'number', required: 'true', effective_from: '2026-06-01' }));
  // 28 May 2025: the RCD question did not exist yet, so it is not needed
  const old = save(env, req(env, { code: env.codes.owner, table: 'check_log', fields: { check_type_id: pat, item_id: kettle, outcome: 'ok', happened_at: '2025-05-28T11:00:00Z', confirm_unusual: 'yes' }, values: { insulation: '19.99' } }));
  assert.equal(old.ok, true, JSON.stringify(old));
  assert.deepEqual(recs(env, 'BLD-check_value.csv').map((v) => [v.field_key, v.value]), [['insulation', '19.99']]);
  // today it is needed
  const other = item(env, '03', 'appliance_class_1', { name: 'Toaster' });
  const now = save(env, req(env, { code: env.codes.owner, table: 'check_log', fields: { check_type_id: pat, item_id: other, outcome: 'ok' }, values: { insulation: '19.99' } }));
  assert.equal(now.ok, false);
  assert.match(JSON.stringify(now), /values.rcd_trip/);
});

test('items: an extinguisher keeps its size, made and expiry dates; expiry cannot be before made', () => {
  const env = env0();
  kind(env, 'extinguisher_co2');
  const bad = owner(env, 'items', { item_no: 'EXT-03', name: 'CO2', kind_key: 'extinguisher_co2', made_on: '2025-08-01', expires_on: '2024-01-01' });
  assert.match(JSON.stringify(bad), /expiry date cannot be before/);
  item(env, 'EXT-03', 'extinguisher_co2', { name: 'CO2', size: '2.2 kg', made_on: '2025-08-01', expires_on: '2035-08-01' });
  const row = recs(env, 'BLD-items.csv')[0];
  assert.deepEqual([row.size, row.made_on, row.expires_on], ['2.2 kg', '2025-08-01', '2035-08-01']);
});

test('qr_tag: a tag can open an item', () => {
  const env = env0();
  assert.ok(env.ctx.TABLES.qr_tag.input.kind.values.includes('item'));
});

test('links: an item is placed in one room at a time; a move ends the old row first', () => {
  const { env, kettle } = setup();
  const place = (to, from, extra) => owner(env, 'links', Object.assign({ from_table: 'items', from_id: kettle, role: 'placed_in', to_table: 'areas', to_id: to, from_date: from, source: 'PAT certificate 28 May 2025' }, extra || {}));
  ok(place('area-t1', '2025-05-28', { to_date: '2026-11-13' }));
  const clash = place('area-t2', '2026-11-01');
  assert.equal(clash.ok, false);
  assert.match(JSON.stringify(clash), /still in another place/);
  ok(place('area-t2', '2026-11-14'));
  assert.equal(recs(env, 'BLD-links.csv').length, 2);
});

test('links: any record to any record with an owner role word; bad words and self links refused', () => {
  const { env, kettle, pat } = setup();
  ok(owner(env, 'links', { from_table: 'check_types', from_id: pat, role: 'governed_by', to_table: 'sops', to_id: 'electrical-safety', from_date: '2025-01-01' }));
  assert.match(JSON.stringify(owner(env, 'links', { from_table: 'Items!', from_id: kettle, role: 'x', to_table: 'areas', to_id: 'a', from_date: '2025-01-01' })), /lower-case/);
  assert.match(JSON.stringify(owner(env, 'links', { from_table: 'items', from_id: kettle, role: 'same_as', to_table: 'items', to_id: kettle, from_date: '2025-01-01' })), /cannot link to itself/);
  assert.equal(save(env, req(env, { code: env.codes.staff, table: 'links', fields: { from_table: 'items', from_id: kettle, role: 'placed_in', to_table: 'areas', to_id: 'area-t1', from_date: '2025-01-01' } })).ok, false);
});
