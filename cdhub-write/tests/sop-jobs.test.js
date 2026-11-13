'use strict';
/**
 * 12 Nov 2026, SOP jobs (via OVERSEER 4): litter jobs (check_type target litter, check_log.litter_id), a whole-site job
 * that covers room jobs must name its isolation rooms, and a check's form (BLD-check_field questions, BLD-check_value
 * answers saved with the check_log row, all or none).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const TYPE_H = ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency', 'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas'];
const LOG_H = ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at', 'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id', 'note_for_id'];
const FIELD_H = ['id', 'tenant_id', 'type_key', 'field_key', 'label', 'kind', 'choices', 'required', 'sort', 'active', 'effective_from', 'set_at', 'set_by'];
const VALUE_H = ['id', 'tenant_id', 'check_log_id', 'check_field_id', 'field_key', 'value'];
const NOW = Date.UTC(2026, 10, 12, 10, 0, 0);

const env0 = (props) => {
  const env = standardEnv({ nowMs: NOW, props: Object.assign({ TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true', TABLE_ON_check_field: 'true', TABLE_ON_check_value: 'true' }, props || {}) });
  env.addFile('BLD-check_type.csv', fx.headerOnly(TYPE_H));
  env.addFile('BLD-check_log.csv', fx.headerOnly(LOG_H));
  env.addFile('BLD-check_field.csv', fx.headerOnly(FIELD_H));
  env.addFile('BLD-check_value.csv', fx.headerOnly(VALUE_H));
  env.addFile('BLD-litter.csv', ['id,tenant_id,name', `ltr-1,${fx.TENANT},Spring`].join('\r\n') + '\r\n');
  return env;
};
const recs = (env, title) => { const f = env.file(title)[0];
  const [h, ...rows] = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === '')); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || '']))); };
const type = (env, key, extra) => save(env, req(env, { code: env.codes.owner, table: 'check_type', fields: Object.assign({ type_key: key, label: key, target: 'dog', effective_from: '2026-01-01' }, extra || {}) }));
const typeId = (env, key, extra) => { const r = type(env, key, extra); assert.equal(r.ok, true, JSON.stringify(r)); return r.result.id; };
const field = (env, extra) => save(env, req(env, { code: env.codes.owner, table: 'check_field', fields: Object.assign({ type_key: 'weigh', field_key: 'weight', label: 'Weight', kind: 'number', effective_from: '2026-01-01' }, extra || {}) }));
const log = (env, f, values, code) => save(env, req(env, Object.assign({ code: code || env.codes.staff, table: 'check_log', fields: Object.assign({ outcome: 'ok' }, f) }, values === undefined ? {} : { values })));

// ---- 1. litter
test('litter: a check can target a litter; a litter job saves with litter_id, the last column, and the litter must exist', () => {
  const env = env0();
  const id = typeId(env, 'pup_weigh', { target: 'litter' });
  assert.deepEqual(Array.from(env.ctx.TABLES.check_log.columns).slice(-2), ['litter_id', 'note_for_id']);
  const r = log(env, { check_type_id: id, litter_id: 'ltr-1' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(recs(env, 'BLD-check_log.csv')[0].litter_id, 'ltr-1');
  assert.equal(log(env, { check_type_id: id, litter_id: 'ltr-zz' }).code, 'INVALID');
});

test('litter: the repeat guard tells two litters apart; the same litter twice is a repeat', () => {
  const env = env0();
  const csv = env.file('BLD-litter.csv')[0]; csv.content += `ltr-2,${fx.TENANT},Autumn\r\n`;
  const id = typeId(env, 'pup_weigh', { target: 'litter' });
  assert.equal(log(env, { check_type_id: id, litter_id: 'ltr-1' }).ok, true);
  assert.equal(log(env, { check_type_id: id, litter_id: 'ltr-2' }).ok, true);
  assert.equal(log(env, { check_type_id: id, litter_id: 'ltr-1' }).code, 'DUPLICATE');
});

// ---- 2. isolation
test('a whole-site job that includes a room job must list its isolation rooms (or none); one including only dog jobs need not', () => {
  const env = env0();
  typeId(env, 'room_clean', { target: 'area' });
  typeId(env, 'nails', { target: 'dog' });
  const bad = type(env, 'deep_clean', { target: 'none', includes: 'room_clean' });
  assert.equal(bad.ok, false); assert.match(bad.fields.not_in_areas, /isolation/);
  assert.equal(type(env, 'deep_clean', { target: 'none', includes: 'room_clean', not_in_areas: 'area-t2' }).ok, true);
  assert.equal(type(env, 'site_wash', { target: 'none', includes: 'room_clean', not_in_areas: 'none' }).ok, true);
  assert.equal(type(env, 'groom_day', { target: 'none', includes: 'nails' }).ok, true);
});

test('the room-job test uses each included job\'s latest version', () => {
  const env = env0();
  typeId(env, 'bedding', { target: 'dog' });
  typeId(env, 'bedding', { target: 'area', effective_from: '2026-06-01' });
  assert.equal(type(env, 'deep_clean', { target: 'none', includes: 'bedding' }).ok, false);
});

// ---- 4. forms
test('check_field: the owner adds questions; a choice needs 2+ answers, other kinds none; the check must exist; a change needs a later date', () => {
  const env = env0();
  typeId(env, 'weigh');
  const r = field(env);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.match(r.result.id, /^cfd-/);
  assert.deepEqual(Object.keys(recs(env, 'BLD-check_field.csv')[0]), FIELD_H);
  assert.equal(field(env, { field_key: 'stool', kind: 'choice', choices: 'firm' }).ok, false);
  const c = field(env, { field_key: 'stool', kind: 'choice', choices: ' firm | soft |loose ' });
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(recs(env, 'BLD-check_field.csv')[1].choices, 'firm|soft|loose');
  assert.equal(field(env, { field_key: 'note2', kind: 'text', choices: 'a|b' }).ok, false);
  assert.equal(field(env, { type_key: 'nope' }).fields.type_key, 'No check with that name.');
  assert.equal(field(env, { field_key: 'Bad Key' }).ok, false);
  assert.equal(field(env).ok, false);                                  // same question, same date
  assert.equal(field(env, { label: 'Weight kg', effective_from: '2026-06-01' }).ok, true);
  assert.equal(field(env, { effective_from: '2026-03-01' }).ok, false);   // older than the newest version
  assert.equal(save(env, req(env, { code: env.codes.staff, table: 'check_field', fields: { type_key: 'weigh', field_key: 'x', label: 'x', kind: 'text', effective_from: '2026-02-01' } })).code, 'NOT_ALLOWED');
});

test('check_value can never be sent on its own', () => {
  const env = env0();
  assert.equal(save(env, req(env, { code: env.codes.owner, table: 'check_value', fields: {} })).code, 'NOT_ALLOWED');
});

test('forms: answers save with the record, one row each, pointing at the record and the question version in force', () => {
  const env = env0();
  const id = typeId(env, 'weigh');
  field(env, { required: 'true' });
  field(env, { field_key: 'stool', label: 'Stool', kind: 'choice', choices: 'firm|soft' });
  field(env, { field_key: 'fed', label: 'Fed', kind: 'yesno' });
  field(env, { label: 'Weight kg', effective_from: '2026-06-01' });
  field(env, { field_key: 'later', label: 'Later', kind: 'text', effective_from: '2026-12-01', required: 'true' });   // not in force yet
  const r = log(env, { check_type_id: id, subject_id: 'sub-test-a' }, { weight: '12.5', stool: 'firm', fed: '' });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.result.answers, 2);
  const vals = recs(env, 'BLD-check_value.csv');
  assert.deepEqual(vals.map((v) => [v.check_log_id, v.field_key, v.value]), [[r.result.id, 'weight', '12.5'], [r.result.id, 'stool', 'firm']]);
  const newest = recs(env, 'BLD-check_field.csv').find((f) => f.label === 'Weight kg');
  assert.equal(vals[0].check_field_id, newest.id);
  assert.match(vals[0].id, /^cvl-/);
});

test('forms: any bad answer refuses the whole save; nothing is written to either list', () => {
  const env = env0();
  const id = typeId(env, 'weigh');
  field(env, { required: 'true' });
  field(env, { field_key: 'stool', label: 'Stool', kind: 'choice', choices: 'firm|soft' });
  field(env, { field_key: 'on', label: 'On', kind: 'date' });
  field(env, { field_key: 'what', label: 'What', kind: 'text' });
  const go = (values) => log(env, { check_type_id: id, subject_id: 'sub-test-a' }, values);
  assert.equal(go({}).fields['values.weight'], 'This is needed.');
  assert.equal(go({ weight: 'heavy' }).fields['values.weight'], 'Type a number, e.g. 12.5.');
  assert.match(go({ weight: '12', stool: 'runny' }).fields['values.stool'], /Not one of/);
  assert.equal(go({ weight: '12', on: '2026-02-30' }).code, 'INVALID');
  assert.equal(go({ weight: '12', what: '=SUM(A1)' }).code, 'INVALID');
  assert.equal(go({ weight: '12', colour: 'red' }).fields['values.colour'], 'This question is not on the form.');
  assert.equal(go(['12']).code, 'INVALID');
  assert.equal(recs(env, 'BLD-check_log.csv').length, 0);
  assert.equal(recs(env, 'BLD-check_value.csv').length, 0);
});

test('forms: an inactive question is dropped from its date; a check with no questions saves as before', () => {
  const env = env0();
  const id = typeId(env, 'weigh');
  const plain = typeId(env, 'feeding');
  field(env, { required: 'true' });
  field(env, { required: 'true', active: 'false', effective_from: '2026-06-01' });
  const r = log(env, { check_type_id: id, subject_id: 'sub-test-a' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(log(env, { check_type_id: plain, subject_id: 'sub-test-a' }).ok, true);
  assert.equal(recs(env, 'BLD-check_value.csv').length, 0);
});

test('forms: switched off, answers are refused and questions are not required; a whole-site tap never takes answers', () => {
  const env = env0({ TABLE_ON_check_value: 'false' });
  const id = typeId(env, 'weigh');
  field(env, { required: 'true' });
  assert.equal(log(env, { check_type_id: id, subject_id: 'sub-test-a' }, { weight: '12' }).code, 'TABLE_OFF');
  assert.equal(log(env, { check_type_id: id, subject_id: 'sub-test-a' }).ok, true);
  const on = env0();
  const site = typeId(on, 'bowls', { target: 'none' });
  const r = save(on, req(on, { code: on.codes.staff, table: 'check_log', action: 'add_site', fields: { check_type_id: site, outcome: 'ok' }, values: { a: '1' } }));
  assert.equal(r.code, 'BAD_REQUEST');
});

test('forms: in pending mode a check with questions is refused rather than queued without its answers', () => {
  const env = env0({ MODE_check_log: 'pending' });
  const id = typeId(env, 'weigh');
  field(env);
  const r = log(env, { check_type_id: id, subject_id: 'sub-test-a' }, { weight: '12' });
  assert.equal(r.code, 'INVALID'); assert.match(r.fields.values, /straight in/);
  assert.equal(log(env, { check_type_id: id, subject_id: 'sub-test-a' }).ok, true);   // no answers, nothing required: queues as before
});

// ---- only_in_areas (12 Nov 2026): a room job for some rooms only, e.g. the isolation jobs
test('only_in_areas: a room job for some rooms only; it is the last column; never saved for another room', () => {
  const env = env0();
  assert.deepEqual(Array.from(env.ctx.TABLES.check_type.columns).slice(-2), ['not_in_areas', 'only_in_areas']);
  assert.match(type(env, 'iso_dog', { target: 'dog', only_in_areas: 'area-t2' }).fields.only_in_areas, /room job/);
  assert.match(type(env, 'iso_bad', { target: 'area', only_in_areas: 'area t2|' }).fields.only_in_areas, /room ids/);
  const iso = typeId(env, 'iso_clean', { target: 'area', only_in_areas: ' area-t2 | ' });
  assert.equal(recs(env, 'BLD-check_type.csv').find((r) => r.type_key === 'iso_clean').only_in_areas, 'area-t2');
  const bad = log(env, { check_type_id: iso, area_id: 'area-t1' });
  assert.equal(bad.code, 'INVALID'); assert.match(bad.fields.area_id, /not for this room/);
  assert.equal(log(env, { check_type_id: iso, area_id: 'area-t2' }).ok, true);
  const any = typeId(env, 'room_clean', { target: 'area' });   // blank = every room
  assert.equal(log(env, { check_type_id: any, area_id: 'area-t1' }).ok, true);
});

// ---- 4. a note added to a job already done (Lisa 13 Nov 2026: "in addition to done rather than instead")
test('note: added to a record already saved, never a duplicate and never blocking one; must point at a real, non-note record', () => {
  const env = env0();
  const id = typeId(env, 'pup_weigh', { target: 'litter' });
  const done = log(env, { check_type_id: id, litter_id: 'ltr-1' });
  assert.equal(done.ok, true);
  const n1 = log(env, { check_type_id: id, litter_id: 'ltr-1', outcome: 'note', note: 'Runt slow to feed', note_for_id: done.result.id });
  assert.equal(n1.ok, true, JSON.stringify(n1));
  assert.equal(log(env, { check_type_id: id, litter_id: 'ltr-1', outcome: 'note', note: 'Second note', note_for_id: done.result.id }).ok, true);
  assert.equal(log(env, { check_type_id: id, litter_id: 'ltr-1' }).code, 'DUPLICATE');   // the done row still guards against a second done
  const rows = recs(env, 'BLD-check_log.csv');
  assert.equal(rows.filter((r) => r.outcome === 'note' && r.note_for_id === done.result.id).length, 2);
  const bad = (f) => log(env, Object.assign({ check_type_id: id, litter_id: 'ltr-1', outcome: 'note', note: 'x', note_for_id: done.result.id }, f));
  assert.equal(bad({ note: '' }).fields.note, 'Type the note.');
  assert.equal(bad({ note_for_id: '' }).fields.note_for_id, 'Say which record the note is for.');
  assert.equal(bad({ note_for_id: 'clg-nope' }).fields.note_for_id, 'That record was not found.');
  assert.equal(bad({ note_for_id: n1.result.id }).fields.note_for_id, 'That record was not found.');   // not a note on a note
  assert.equal(bad({ outcome: 'ok' }).fields.note_for_id, 'Only a note can point at another record.');
});
