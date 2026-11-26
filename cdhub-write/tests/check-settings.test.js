'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');
const Due = require('../records/due.js');
const Rules = require('../../cdhub/check-rules.js');
const Register = require('../../cdhub/checks-register.js');

const TYPE_H = ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency', 'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas', 'item_kind', 'only_groups'];
const LOG_H = ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at', 'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id', 'note_for_id', 'item_id', 'time_given', 'grant_id', 'counts_due', 'covered_ids', 'exceptions'];
const SET_H = ['id', 'tenant_id', 'type_key', 'record_as', 'every_days', 'frequency', 'site_scope', 'session_row', 'from_date', 'to_date', 'source', 'set_by', 'set_at'];
const RET_H = ['id', 'tenant_id', 'section', 'keep_years', 'basis', 'set_by', 'set_on', 'from_date', 'to_date'];

const env0 = () => {
  const env = standardEnv({ props: { TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true', TABLE_ON_check_setting: 'true', TABLE_ON_retention_setting: 'true' } });
  env.addFile('BLD-check_type.csv', fx.headerOnly(TYPE_H));
  env.addFile('BLD-check_log.csv', fx.headerOnly(LOG_H));
  env.addFile('BLD-check_setting.csv', fx.headerOnly(SET_H));
  env.addFile('BLD-retention_setting.csv', fx.headerOnly(RET_H));
  return env;
};
const recs = (env, title) => {
  const [h, ...rows] = env.ctx.csvParse_(env.file(title)[0].content).filter((r) => !(r.length === 1 && r[0] === ''));
  return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || ''])));
};
const addType = (env, key, extra) => {
  const r = save(env, req(env, { code: env.codes.user, table: 'check_type', fields: Object.assign({ type_key: key, label: key, target: 'dog', effective_from: '2026-01-01' }, extra || {}) }));
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.result.id;
};
const set = (env, fields) => save(env, req(env, { code: env.codes.user, table: 'check_setting', fields }));
const site = (env, fields, action) => save(env, req(env, { code: env.codes.staff, table: 'check_log', action: action || 'add_site', fields }));

test('no setting row: a per-dog check that is not a round still writes one line per dog', () => {
  const env = env0();
  const id = addType(env, 'walk', { label: 'Walk', target: 'none', site_scope: 'per_dog', not_in_areas: 'none', every_days: '1' });
  const r = site(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-b' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.saved, 1);
  assert.equal(r.result.session, undefined);
  assert.equal(recs(env, 'BLD-check_log.csv')[0].subject_id, 'sub-test-b');
  assert.equal(recs(env, 'BLD-check_log.csv')[0].covered_ids, '');
});

test('Exercise all and Health check all save one session row when no setting has been saved', () => {
  const env = env0();
  const exercise = addType(env, 'exercise_all', { label: 'Exercise and play: all dogs', target: 'none', site_scope: 'per_dog', not_in_areas: 'none', every_days: '1' });
  const health = addType(env, 'health_check_all', { label: 'Health check: all dogs', target: 'none', site_scope: 'per_dog', not_in_areas: 'none', every_days: '1' });
  const ex = site(env, { check_type_id: exercise, outcome: 'ok', dog_ids: 'sub-test-a|sub-test-b', exceptions: 'sub-test-a:not_here' });
  assert.equal(ex.ok, true, JSON.stringify(ex));
  assert.equal(ex.result.session, true);
  assert.equal(ex.result.saved, 1);
  assert.equal(ex.result.covered_ids, 'sub-test-b');
  const healthRow = site(env, { check_type_id: health, outcome: 'ok', dog_ids: 'sub-test-a|sub-test-b' });
  assert.equal(healthRow.result.session, true);
  const rows = recs(env, 'BLD-check_log.csv');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].subject_id, '');
  assert.equal(rows[0].covered_ids, 'sub-test-b');
  assert.equal(rows[0].exceptions, 'sub-test-a:not_here');
  assert.equal(rows[1].covered_ids, 'sub-test-a|sub-test-b');
});

test('how one tap is stored follows the setting; with no setting it stays one line per dog', () => {
  const env = env0();
  const id = addType(env, 'health_check_all', { label: 'Health check: all dogs', target: 'none', site_scope: 'per_dog', not_in_areas: 'none', every_days: '1' });
  assert.equal(set(env, { type_key: 'health_check_all', record_as: 'logged', every_days: '1', site_scope: 'one_line', session_row: 'false', from_date: '2026-01-01', to_date: '2026-12-31', source: 'user' }).ok, true);
  const r = site(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-a|sub-test-b' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const rows = recs(env, 'BLD-check_log.csv');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].subject_id, '');
  assert.equal(rows[0].covered_ids, '');
  const saved = recs(env, 'BLD-check_setting.csv')[0];
  assert.equal(saved.site_scope, 'one_line');
  assert.equal(saved.to_date, '2026-12-31');
  assert.equal(saved.set_by.length > 0, true);
});

test('floors: less often is refused, more often is kept, print only is refused for medicines, incidents and required evidence', () => {
  const env = env0();
  addType(env, 'health_check_all', { label: 'Health check: all dogs', target: 'none', site_scope: 'per_dog', not_in_areas: 'none', every_days: '1', evidence: 'optional', sop: 'Health' });
  addType(env, 'medicine', { label: 'Medicine given', every_days: '1', evidence: 'optional' });
  addType(env, 'incident', { label: 'Incident or near miss', target: 'optional' });
  addType(env, 'fit_to_breed', { label: 'Vet check: fit to breed', every_days: '365', frequency: 'Yearly' });
  addType(env, 'photo', { label: 'Photo', evidence: 'required', every_days: '7' });
  const base = { record_as: 'logged', from_date: '2026-11-01', source: 'user' };
  const ask = (extra) => set(env, Object.assign({}, base, extra));
  assert.match(ask({ type_key: 'health_check_all', every_days: '2' }).fields.every_days, /more often, not less/);
  assert.match(ask({ type_key: 'health_check_all', every_days: '' }).fields.every_days, /more often, not less/);
  const ok = ask({ type_key: 'health_check_all', every_days: '1', frequency: 'Daily', site_scope: 'per_dog', session_row: 'false' });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const row = recs(env, 'BLD-check_setting.csv')[0];
  assert.equal(row.record_as, 'logged');
  assert.equal(row.set_by.length > 0, true);
  assert.ok(row.from_date);
  assert.match(ask({ type_key: 'medicine', every_days: '1', record_as: 'print' }).fields.record_as, /Medicines/);
  assert.match(ask({ type_key: 'incident', record_as: 'print' }).fields.record_as, /Incidents/);
  assert.match(ask({ type_key: 'fit_to_breed', every_days: '365', record_as: 'print' }).fields.record_as, /yearly vet/i);
  assert.match(ask({ type_key: 'photo', every_days: '7', record_as: 'print' }).fields.record_as, /Evidence is required/);
  assert.match(ask({ type_key: 'bowls', every_days: '1' }).fields.type_key, /in force/);
});

test('one line for the round is only offered for the three checks, and a change must start after the last one', () => {
  const env = env0();
  addType(env, 'nails', { every_days: '28' });
  const bad = set(env, { type_key: 'nails', record_as: 'logged', every_days: '28', session_row: 'true', from_date: '2026-11-01', source: 'user' });
  assert.match(bad.fields.session_row, /Present, Health check/);
  addType(env, 'health_check_all', { label: 'Health check: all dogs', target: 'none', site_scope: 'per_dog', not_in_areas: 'none', every_days: '1' });
  assert.equal(set(env, { type_key: 'health_check_all', record_as: 'both', every_days: '1', session_row: 'true', from_date: '2026-11-01', source: 'user' }).ok, true);
  const again = set(env, { type_key: 'health_check_all', record_as: 'logged', every_days: '1', session_row: 'true', from_date: '2026-11-01', source: 'user' });
  assert.match(again.fields.from_date, /after that date/);
});

test('session switch off writes one line per dog and refuses a session save; the default is one session row', () => {
  const env = env0();
  const id = addType(env, 'exercise_all', { label: 'Exercise and play: all dogs', target: 'none', site_scope: 'per_dog', not_in_areas: 'none', every_days: '1' });
  assert.equal(set(env, { type_key: 'exercise_all', record_as: 'logged', every_days: '1', session_row: 'false', from_date: '2026-01-01', source: 'user' }).ok, true);
  const off = site(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-b' }, 'add_session');
  assert.equal(off.ok, false, JSON.stringify(off));
  assert.match((off.fields && off.fields.check_type_id) || off.message || '', /one line per dog|one line for the round/i);
  const per = site(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-b' });
  assert.equal(per.result.session, undefined);
  assert.equal(recs(env, 'BLD-check_log.csv')[0].subject_id, 'sub-test-b');
  const health = addType(env, 'health_check_all', { label: 'Health check: all dogs', target: 'none', site_scope: 'per_dog', not_in_areas: 'none', every_days: '1' });
  const r = site(env, { check_type_id: health, outcome: 'ok', dog_ids: 'sub-test-a|sub-test-b', exceptions: 'sub-test-a:not_here' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.session, true);
  assert.equal(r.result.saved, 1);
  const rows = recs(env, 'BLD-check_log.csv');
  assert.equal(rows.length, 2);
  assert.equal(rows[1].subject_id, '');
  assert.equal(rows[1].covered_ids, 'sub-test-b');
  assert.equal(rows[1].exceptions, 'sub-test-a:not_here');
});

test('print only refuses a log row; logged and both still save', () => {
  const env = env0();
  const id = addType(env, 'bowls', { label: 'Bowls', target: 'none', site_scope: 'one_line', every_days: '1' });
  assert.equal(set(env, { type_key: 'bowls', record_as: 'print', every_days: '1', from_date: '2026-01-01', source: 'user' }).ok, true);
  const refused = save(env, req(env, { code: env.codes.staff, table: 'check_log', fields: { check_type_id: id, outcome: 'ok' } }));
  assert.match(refused.fields.check_type_id, /print sheet only/i);
  assert.equal(recs(env, 'BLD-check_log.csv').length, 0);
});

test('check records cannot be kept for fewer than 6 years', () => {
  const env = env0();
  const low = save(env, req(env, { code: env.codes.user, table: 'retention_setting', fields: { section: 'checks', keep_years: '5', from_date: '2026-11-01', basis: 'user' } }));
  assert.match(low.fields.keep_years, /6 years/);
  const ok = save(env, req(env, { code: env.codes.user, table: 'retention_setting', fields: { section: 'checks', keep_years: '7', from_date: '2026-11-01', basis: 'user' } }));
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(recs(env, 'BLD-retention_setting.csv')[0].keep_years, '7');
});

test('a session row counts as done for each listed dog, an exception stays outstanding, and an old per-dog row still counts', () => {
  const types = [{ id: 'ct', type_key: 'health_check_all', label: 'Health check: all dogs', target: 'none', site_scope: 'per_dog', every_days: '1', active: 'true', effective_from: '2026-01-01', not_in_areas: 'none' }];
  const dogs = [{ id: 'a', area_id: 'r1' }, { id: 'b', area_id: 'r1' }, { id: 'c', area_id: 'r1' }];
  const logs = [
    { id: 'old', check_type_id: 'ct', subject_id: 'c', outcome: 'ok', happened_at: '2026-11-24T10:00:00Z', taken_at: '2026-11-24T10:00:00Z' },
    { id: 's1', check_type_id: 'ct', covered_ids: 'a|b', exceptions: 'b:concern:limping', outcome: 'ok', happened_at: '2026-11-25T09:00:00Z', taken_at: '2026-11-25T09:00:00Z' },
    { id: 's0', check_type_id: 'ct', covered_ids: 'a|b|c', outcome: 'ok', happened_at: '2026-11-25T08:00:00Z', taken_at: '2026-11-25T08:00:00Z' }
  ];
  const dog = (id) => [{ id, area_id: 'r1' }];
  const all = Due.forTarget(types, logs, { dogs }, '2026-11-25');
  assert.equal(all.find((j) => j.type_key === 'health_check_all').status, 'never');
  assert.equal(Due.forTarget(types, logs, { dogs: dog('a') }, '2026-11-25')[0].last_done, '2026-11-25');
  assert.equal(Due.forTarget(types, logs, { dogs: dog('b') }, '2026-11-25')[0].status, 'never');
  assert.equal(Due.forTarget(types, logs, { dogs: dog('c') }, '2026-11-25')[0].last_done, '2026-11-24');
  const oneLine = Due.forTarget(types, [{ id: 'one', check_type_id: 'ct', outcome: 'ok', happened_at: '2026-11-25T09:00:00Z' }], { dogs }, '2026-11-25', [], { settings: [{ type_key: 'health_check_all', site_scope: 'one_line', every_days: '1', from_date: '2026-01-01' }] });
  assert.equal(oneLine[0].status, 'ok');
});

test('the register and the rules helper name every dog on a session row and mark the exception', () => {
  global.BLDCheckRules = Rules;
  const log = { id: 's', check_type_id: 'ct', outcome: 'ok', happened_at: '2026-11-25T09:00:00Z', covered_ids: 'a|b', exceptions: 'b:not_here', how_recorded: 'site_tap' };
  const lines = Register.build([log], { month: '2026-11', types: [{ id: 'ct', label: 'Present' }], dogName: (id) => (id === 'a' ? 'Ada' : 'Bea') });
  assert.deepEqual(lines.map((l) => [l.subject, l.result]), [['Ada', 'done'], ['Bea', 'not here']]);
  const card = Rules.dogLine({ id: 'a' }, { 'BLD-check_log.csv': [log], 'BLD-check_type.csv': [{ id: 'ct', label: 'Present' }] }, (s) => s);
  assert.match(card, /included in the round/);
  const ex = Rules.dogLine({ id: 'b' }, { 'BLD-check_log.csv': [log], 'BLD-check_type.csv': [{ id: 'ct', label: 'Present' }] }, (s) => s);
  assert.match(ex, /included in the round/);
  assert.match(ex, /not here/);
});

test('a past day uses the setting in force that day, not a later one', () => {
  const type = { type_key: 'bowls', every_days: '1', evidence: 'none', label: 'Bowls' };
  const rows = [
    { type_key: 'bowls', every_days: '1', record_as: 'logged', from_date: '2026-01-01', to_date: '2026-10-31' },
    { type_key: 'bowls', every_days: '1', record_as: 'both', from_date: '2026-11-01' }
  ];
  assert.equal(Rules.effective(type, Rules.settingFor(rows, 'bowls', '2026-06-01')).record_as, 'logged');
  assert.equal(Rules.effective(type, Rules.settingFor(rows, 'bowls', '2026-11-25')).record_as, 'both');
  assert.equal(Rules.keepYears([], '2026-11-25'), 6);
  assert.equal(Rules.keepYears([{ section: 'checks', keep_years: '8', from_date: '2026-01-01' }], '2026-11-25'), 8);
});

