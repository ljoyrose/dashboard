'use strict';
/**
 * 25 Nov 2026: the live job log grew past 4,900 rows and every Present tap read every column of every row
 * while holding the lock. A save must append, leave existing taken_by values alone, and read only the last
 * rows (plus id and time) unless a row inside the 30-minute window sits higher up the sheet.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const TYPE_H = ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency', 'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas', 'item_kind', 'only_groups'];
const LOG_H = ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at', 'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id', 'note_for_id', 'item_id', 'time_given', 'grant_id', 'counts_due', 'covered_ids', 'exceptions'];
const LOG = 'BLD-check_log.csv';
const NOW = Date.UTC(2026, 10, 25, 16, 0, 0);   // 16:00 GMT, 25 Nov 2026
const OLD_N = 400;   // more than SAVE_TAIL_ROWS (200), so a full-sheet read is visible
const whoAt = LOG_H.indexOf('taken_by');

function iso(ms) { return new Date(ms).toISOString(); }

function row(over) {
  const o = Object.assign({ tenant_id: fx.TENANT, area_id: 'area-t1', outcome: 'recorded', item: 'present', taken_by: 'Hafwen' }, over);
  return LOG_H.map((c) => (o[c] == null ? '' : String(o[c])));
}

function bigLog(recent) {
  const env = standardEnv({ nowMs: NOW, props: { TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true' } });
  env.addFile('BLD-check_type.csv', fx.headerOnly(TYPE_H));
  env.addFile(LOG, fx.headerOnly(LOG_H));
  const t = save(env, req(env, { code: env.codes.owner, table: 'check_type', fields: { type_key: 'round.presence', label: 'Present', target: 'dog', effective_from: '2026-01-01' } }));
  assert.equal(t.ok, true, JSON.stringify(t));
  const typeId = t.result.id;
  const sheet = [LOG_H.slice()];
  for (let i = 0; i < OLD_N; i++) {
    const at = iso(NOW - (OLD_N - i) * 3600000);
    sheet.push(row({ id: 'clg-old' + i, check_type_id: typeId, subject_id: 'sub-test-e', happened_at: at, taken_at: at, taken_by: i % 2 ? 'Hafwen' : 'Demo' }));
  }
  if (recent) {
    sheet[recent.index] = row({ id: recent.id, check_type_id: typeId, subject_id: recent.subject || 'sub-test-a', item: 'present', outcome: 'recorded', happened_at: iso(recent.ms), taken_at: iso(recent.ms), taken_by: recent.who || 'LC' });
  }
  const f = env.file(LOG)[0];
  f.sheet = sheet;
  f.fmt = {};
  f.maxRows = sheet.length + 20;
  delete f.content;
  env.ranges.length = 0;
  env.sheetWrites.length = 0;
  return { env, typeId, before: sheet.length };
}

function wideReads(env) {
  return env.ranges.filter((r) => r[0] === LOG && r[3] > 200 && r[4] > 1);
}
function fields(typeId, subject) {
  return { check_type_id: typeId, area_id: 'area-t1', subject_id: subject, item: 'present', outcome: 'recorded', happened_at: iso(NOW), how_recorded: 'tapped' };
}

test('a Present save on a long job log appends one row and does not read or rewrite the old rows @regression', () => {
  const { env, typeId, before } = bigLog();
  const r = save(env, req(env, { table: 'check_log', fields: fields(typeId, 'sub-test-a') }));
  assert.equal(r.ok, true, JSON.stringify(r));
  const sheet = env.rows(LOG);
  assert.equal(sheet.length, before + 1);
  assert.equal(sheet[1][whoAt], 'Demo');
  assert.equal(sheet[2][whoAt], 'Hafwen');
  assert.equal(wideReads(env).length, 0, JSON.stringify(wideReads(env)));
  assert.ok(env.sheetWrites.every((w) => w.title !== LOG || w.row > before), JSON.stringify(env.sheetWrites));
});

test('the same Present tap inside 30 minutes is still a repeat, and an older one is not', () => {
  const recent = bigLog({ index: OLD_N, id: 'clg-recent', ms: NOW - 5 * 60000, who: 'LC' });
  const dup = save(recent.env, req(recent.env, { table: 'check_log', fields: fields(recent.typeId, 'sub-test-a') }));
  assert.equal(dup.code, 'DUPLICATE', JSON.stringify(dup));
  assert.equal(recent.env.rows(LOG).length, recent.before);
  assert.equal(recent.env.rows(LOG)[OLD_N][whoAt], 'LC');
  assert.equal(wideReads(recent.env).length, 0);

  const old = bigLog({ index: OLD_N, id: 'clg-earlier', ms: NOW - 2 * 3600000, who: 'Hafwen' });
  const ok = save(old.env, req(old.env, { table: 'check_log', fields: fields(old.typeId, 'sub-test-a') }));
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(old.env.rows(LOG)[OLD_N][whoAt], 'Hafwen');
  assert.equal(wideReads(old.env).length, 0);
});

test('a repeat that sits above the last rows is still caught, without reading every column', () => {
  const { env, typeId, before } = bigLog({ index: 1, id: 'clg-high', ms: NOW - 60000, who: 'Owner (written by Claude)', subject: 'sub-test-b' });
  const dup = save(env, req(env, { table: 'check_log', fields: fields(typeId, 'sub-test-b') }));
  assert.equal(dup.code, 'DUPLICATE', JSON.stringify(dup));
  assert.equal(env.rows(LOG).length, before);
  assert.equal(env.rows(LOG)[1][whoAt], 'Owner (written by Claude)');
  assert.equal(wideReads(env).length, 0, JSON.stringify(wideReads(env)));
});

test('a list of Present taps reads the job log once and appends once, and the second identical tap is a repeat', () => {
  const { env, typeId, before } = bigLog();
  const many = (items) => save(env, { v: 1, request_id: 'r-batch-log01', code: env.codes.staff, action: 'add_many', items });
  const r = many([
    { request_id: 'r-item-log001', table: 'check_log', fields: fields(typeId, 'sub-test-a') },
    { request_id: 'r-item-log002', table: 'check_log', fields: fields(typeId, 'sub-test-b') },
    { request_id: 'r-item-log003', table: 'check_log', fields: fields(typeId, 'sub-test-a') }
  ]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.items[0].ok, true, JSON.stringify(r.result.items[0]));
  assert.equal(r.result.items[1].ok, true, JSON.stringify(r.result.items[1]));
  assert.equal(r.result.items[2].ok, false);
  assert.equal(r.result.items[2].code, 'DUPLICATE');
  assert.equal(env.rows(LOG).length, before + 2);
  assert.equal(env.rows(LOG)[1][whoAt], 'Demo');
  const tall = env.ranges.filter((x) => x[0] === LOG && x[3] > 200 && x[4] === 1);
  assert.ok(tall.length <= 2, 'id and time once, not once per tap: ' + tall.length);
  const adds = env.sheetWrites.filter((w) => w.title === LOG);
  assert.equal(adds.length, 1, JSON.stringify(adds.map((w) => [w.row, w.vals.length])));
  assert.equal(adds[0].vals.length, 2);
  assert.ok(adds[0].row > before);
});
