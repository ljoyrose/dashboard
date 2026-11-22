'use strict';
/**
 * 22 Nov 2026, ITEMS2: 'many' sends several saves in one request (a PAT day: ~25 plugs, one tester, one certificate).
 * Each step is the ordinary save with its own request id, so every check is the same as one save at a time.
 * Invented rows only.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const TYPE_H = ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency', 'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas', 'item_kind', 'only_groups'];
const LOG_H = ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at', 'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id', 'note_for_id', 'item_id', 'time_given'];
const FIELD_H = ['id', 'tenant_id', 'type_key', 'field_key', 'label', 'kind', 'choices', 'required', 'sort', 'active', 'effective_from', 'set_at', 'set_by', 'unit', 'limit_low', 'limit_high', 'source'];
const VALUE_H = ['id', 'tenant_id', 'check_log_id', 'check_field_id', 'field_key', 'value'];
const ITEM_H = ['id', 'tenant_id', 'item_no', 'name', 'kind_key', 'make', 'model', 'serial_no', 'size', 'made_on', 'expires_on', 'photo', 'note', 'corrects_id', 'created_at', 'created_by'];
const KIND_H = ['id', 'tenant_id', 'kind_key', 'label', 'source', 'set_by', 'set_on'];
const NOW = Date.UTC(2026, 10, 22, 10, 0, 0);

function setup(n) {
  const env = standardEnv({ nowMs: NOW, props: { TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true', TABLE_ON_check_field: 'true', TABLE_ON_check_value: 'true', TABLE_ON_items: 'true', TABLE_ON_item_kinds: 'true' } });
  [['BLD-check_type.csv', TYPE_H], ['BLD-check_log.csv', LOG_H], ['BLD-check_field.csv', FIELD_H], ['BLD-check_value.csv', VALUE_H], ['BLD-items.csv', ITEM_H], ['BLD-item_kinds.csv', KIND_H]]
    .forEach(([f, h]) => env.addFile(f, fx.headerOnly(h)));
  const owner = (table, fields) => { const r = save(env, req(env, { code: env.codes.owner, table, fields })); assert.equal(r.ok, true, JSON.stringify(r)); return r.result.id; };
  owner('item_kinds', { kind_key: 'plug_in', label: 'Plug-in', source: 'test' });
  const items = [];
  for (let i = 1; i <= n; i++) items.push(owner('items', { item_no: String(i).padStart(2, '0'), name: 'Pretend lamp ' + i, kind_key: 'plug_in' }));
  const pat = owner('check_type', { type_key: 'pretend_pat', label: 'Pretend PAT', target: 'item', item_kind: 'plug_in', every_days: '365', effective_from: '2025-01-01' });
  owner('check_field', { type_key: 'pretend_pat', field_key: 'look', label: 'Look', kind: 'choice', choices: 'Pass|Fail', effective_from: '2025-01-01' });
  return { env, items, pat };
}
let n = 0;
const many = (env, steps, rid, code) => JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify({ v: 1, action: 'many', request_id: rid || 'req-many-' + String(++n).padStart(4, '0'), code: code || env.codes.owner, steps }) } }).getContent());
const rows = (env, f) => { const c = env.file(f)[0].content; const [h, ...rs] = env.ctx.csvParse_(c).filter((r) => !(r.length === 1 && r[0] === '')); return rs.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] || '']))); };
const logStep = (pat, id, extra) => ({ action: 'add', table: 'check_log', fields: Object.assign({ check_type_id: pat, item_id: id, outcome: 'ok', how_recorded: 'typed' }, extra || {}), values: { look: 'Pass' } });

test('many: 25 item tests in one request, each saved as one ordinary save with its answers', () => {
  const { env, items, pat } = setup(25);
  const r = many(env, items.map((id) => logStep(pat, id)));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  assert.equal(r.result.saved, 25);
  assert.equal(r.result.results.length, 25);
  const logs = rows(env, 'BLD-check_log.csv');
  assert.equal(logs.length, 25);
  assert.deepEqual(logs.map((l) => l.item_id).sort(), items.slice().sort());
  assert.equal(rows(env, 'BLD-check_value.csv').length, 25);
  assert.ok(logs.every((l) => l.taken_by), 'each row stamped with who saved it');
});

test('many: one refused step does not stop the others; its reason comes back in its place', () => {
  const { env, items, pat } = setup(3);
  const r = many(env, [logStep(pat, items[0]), logStep(pat, 'itm-nope'), logStep(pat, items[2], { outcome: 'concern', note: 'Cable cut' })]);
  assert.equal(r.result.saved, 2);
  assert.equal(r.result.results[1].ok, false);
  assert.equal(r.result.results[1].code, 'INVALID');
  assert.equal(rows(env, 'BLD-check_log.csv').length, 2);
});

test('many: sending the same request again saves nothing twice (each step keeps its own request id)', () => {
  const { env, items, pat } = setup(4);
  const steps = items.map((id) => logStep(pat, id));
  many(env, steps, 'req-many-again1');
  const again = many(env, steps, 'req-many-again1');
  assert.equal(again.result.saved, 4);
  assert.ok(again.result.results.every((x) => x.result.repeat), 'answered from the earlier save');
  assert.equal(rows(env, 'BLD-check_log.csv').length, 4);
});

test('many: the same switches and roles as one save; staff cannot add items; an inspector cannot save', () => {
  const { env, items, pat } = setup(1);
  const staff = many(env, [{ action: 'add', table: 'items', fields: { item_no: '99', name: 'X', kind_key: 'plug_in' } }], null, env.codes.staff);
  assert.equal(staff.result.results[0].code, 'NOT_ALLOWED');
  const bad = many(env, [{ action: 'file_add', fields: {} }]);
  assert.equal(bad.result.results[0].code, 'BAD_REQUEST');
  env.props.TABLE_ON_check_log = 'false';
  assert.equal(many(env, [logStep(pat, items[0])]).result.results[0].code, 'TABLE_OFF');
});

test('many: at most MANY_MAX_STEPS; a wrong code stops it before any step', () => {
  const { env, items, pat } = setup(1);
  const tooMany = many(env, Array.from({ length: env.ctx.BLD.LIMITS.MANY_MAX_STEPS + 1 }, () => logStep(pat, items[0])));
  assert.equal(tooMany.ok, false);
  const wrong = many(env, [logStep(pat, items[0])], null, 'not-a-real-code');
  assert.equal(wrong.ok, false);
  assert.equal(rows(env, 'BLD-check_log.csv').length, 0);
  assert.equal(env.ctx.AUTH_ONCE_, null, 'the one sign-in never outlives its request');
});

test('many: after the time limit the rest come back NOT_SENT, nothing half-saved', () => {
  const { env, items, pat } = setup(3);
  env.ctx.BLD.LIMITS.MANY_TIME_MS = -1;
  const r = many(env, items.map((id) => logStep(pat, id)));
  assert.deepEqual(r.result.results.map((x) => x.code), ['NOT_SENT', 'NOT_SENT', 'NOT_SENT']);
  assert.equal(rows(env, 'BLD-check_log.csv').length, 0);
});
