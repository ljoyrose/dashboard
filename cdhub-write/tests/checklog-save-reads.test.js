'use strict';
// 28 Nov 2026: live check_log saves took 17-37 s, 10-25 s of it untimed. A Present save opened the same small lists
// several times. Within one save, a list the save only reads is opened once; the steps are timed. Invented records only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req } = require('./harness');
const fx = require('./fixtures');

const TYPE_H = ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency', 'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas', 'item_kind', 'only_groups'];
const LOG_H = ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at', 'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id', 'note_for_id', 'item_id', 'time_given', 'grant_id', 'counts_due', 'covered_ids', 'exceptions'];
const SET_H = ['id', 'tenant_id', 'type_key', 'record_as', 'every_days', 'frequency', 'site_scope', 'session_row', 'from_date', 'to_date', 'source', 'set_by', 'set_at'];

function env0() {
  const env = standardEnv({ props: { TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true', TABLE_ON_check_setting: 'true' } });
  const t = env.props.TENANT_ID;
  env.addFile('BLD-check_type.csv', TYPE_H.join(',') + '\r\n' + TYPE_H.map((h) => ({ id: 'cty-round_presence-1', tenant_id: t, type_key: 'round.presence', label: 'Present', target: 'dog', active: 'true', effective_from: '2026-01-01', source: 'test' }[h] || '')).join(',') + '\r\n');
  env.addFile('BLD-check_log.csv', fx.headerOnly(LOG_H));
  env.addFile('BLD-check_setting.csv', fx.headerOnly(SET_H));
  return env;
}
function post(env, body) { return JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent()); }
function countReads(env) {
  const c = {}, orig = env.ctx.store_read_;
  env.ctx.store_read_ = (title, must) => { c[title] = (c[title] || 0) + 1; return orig(title, must); };
  return c;
}

test('a Present one-row save opens the check settings and check types once each, and every step is timed @regression', () => {
  const env = env0();
  const reads = countReads(env);
  const r = post(env, req(env, { table: 'check_log', action: 'add_session', fields: { check_type_id: 'cty-round_presence-1', dog_ids: 'sub-test-a|sub-test-b', exceptions: 'sub-test-b:not_here', outcome: 'recorded', how_recorded: 'tapped' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.session, true);
  assert.ok((reads['BLD-check_setting.csv'] || 0) <= 1, JSON.stringify(reads));
  assert.ok((reads['BLD-check_type.csv'] || 0) <= 1, JSON.stringify(reads));
  const t = r.result.timing;
  ['site_type_settings', 'site_lookups', 'site_rooms', 'validate_settings', 'approvals_queue', 'form', 'dup_ids', 'write'].forEach((k) => assert.equal(typeof t[k], 'number', k));
});

test('outside a table save nothing is remembered: two reads of the same list read it twice', () => {
  const env = env0();
  const reads = countReads(env);
  env.ctx.checkSettingFor_('round.presence', '2026-11-28');
  env.ctx.checkSettingFor_('round.presence', '2026-11-28');
  assert.equal(reads['BLD-check_setting.csv'], 2);
});

test('a list the save writes is read fresh afterwards in the same save', () => {
  const env = env0();
  env.ctx.READ_ONCE_ = {};
  const a = env.ctx.store_readOnce_('BLD-check_setting.csv', false);
  env.ctx.store_forget_('BLD-check_setting.csv');
  const b = env.ctx.store_readOnce_('BLD-check_setting.csv', false);
  assert.notEqual(a, b);
  env.ctx.READ_ONCE_ = null;
});
