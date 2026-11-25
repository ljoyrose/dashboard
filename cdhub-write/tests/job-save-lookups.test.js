'use strict';
/**
 * 22 Nov 2026 (live: a job save spent 7.7-12.8 s in lookups_rules, 65% of 19.6 s): each list is read once per save, and
 * the whole job log is read for its note check only when the save is a note. Measured on a 1,079-row job log.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const TYPE_H = ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency', 'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas', 'item_kind', 'only_groups'];
const LOG_H = ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at', 'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id', 'note_for_id', 'item_id', 'time_given', 'grant_id', 'counts_due', 'covered_ids', 'exceptions'];
const NOW = Date.UTC(2026, 10, 22, 10, 0, 0);

function env1079() {
  const env = standardEnv({ nowMs: NOW, props: { TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true' } });
  env.addFile('BLD-check_type.csv', fx.headerOnly(TYPE_H));
  const t = save(env, req(env, { code: env.codes.owner, table: 'check_type', fields: { type_key: 'bowls', label: 'Bowls', target: 'area', effective_from: '2026-01-01' } }));
  assert.equal(t.ok, true, JSON.stringify(t));
  const rows = [LOG_H.join(',')];
  for (let i = 0; i < 1079; i++) {
    const at = new Date(NOW - (1079 - i) * 3600000).toISOString();
    rows.push(LOG_H.map((c) => ({ id: 'clg-old' + i, tenant_id: fx.TENANT, check_type_id: t.result.id, area_id: 'area-t1', outcome: 'ok', happened_at: at, taken_at: at, taken_by: 'Hand' }[c] || '')).join(','));
  }
  env.addFile('BLD-check_log.csv', rows.join('\r\n') + '\r\n');
  return { env, typeId: t.result.id };
}
function countReads(env) {
  const c = {}, orig = env.ctx.store_read_;
  env.ctx.store_read_ = (title, must) => { c[title] = (c[title] || 0) + 1; return orig(title, must); };
  return c;
}

test('a job save on a 1,079-row job log reads the log once (for the save itself) and the job types once', () => {
  const { env, typeId } = env1079();
  const reads = countReads(env);
  const r = save(env, req(env, { code: env.codes.staff, table: 'check_log', fields: { check_type_id: typeId, area_id: 'area-t1', outcome: 'ok' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(reads['BLD-check_log.csv'], 1, JSON.stringify(reads));   // was 2: the save's own read + the note lookup
  assert.ok((reads['BLD-check_type.csv'] || 0) <= 1, JSON.stringify(reads));   // was up to 4 (one per lookup on it)
});

test('a note still checks the record it points at: a real record saves, an unknown one is refused', () => {
  const { env, typeId } = env1079();
  const ok = save(env, req(env, { code: env.codes.staff, table: 'check_log', fields: { check_type_id: typeId, area_id: 'area-t1', outcome: 'note', note: 'Pretend note', note_for_id: 'clg-old5' } }));
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const bad = save(env, req(env, { code: env.codes.staff, table: 'check_log', fields: { check_type_id: typeId, area_id: 'area-t1', outcome: 'note', note: 'Pretend note', note_for_id: 'clg-nothere' } }));
  assert.equal(bad.code, 'INVALID', JSON.stringify(bad));
  assert.match(bad.fields.note_for_id, /not found/);
});

test('a note with no record named is still refused, and a done job naming a record is still refused', () => {
  const { env, typeId } = env1079();
  const a = save(env, req(env, { code: env.codes.staff, table: 'check_log', fields: { check_type_id: typeId, area_id: 'area-t1', outcome: 'note', note: 'Pretend note' } }));
  assert.equal(a.code, 'INVALID'); assert.match(a.fields.note_for_id, /Say which record/);
  const b = save(env, req(env, { code: env.codes.staff, table: 'check_log', fields: { check_type_id: typeId, area_id: 'area-t1', outcome: 'ok', note_for_id: 'clg-old5' } }));
  assert.equal(b.code, 'INVALID'); assert.match(b.fields.note_for_id, /Only a note/);
});
