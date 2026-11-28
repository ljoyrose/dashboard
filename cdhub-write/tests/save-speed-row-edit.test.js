'use strict';
// 27 Nov 2026: one-row edits (e.g. link_end) read the whole Sheet tab three times, and actions answered before the
// table save left no timing. Invented records only.
const { test } = require('node:test');
const assert = require('node:assert');
const { standardEnv } = require('./harness');

const LINKS_H = 'id,tenant_id,from_table,from_id,role,to_table,to_id,from_date,to_date,source,set_by,set_on,sort,note,end_reason,created_at,updated_at'.split(',');
const RULE_H = 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date';
let n = 0;

function env(rowsCount) {
  const e = standardEnv({ props: { TABLE_ON_links: 'true' } });
  const t = e.props.TENANT_ID;
  const rules = [RULE_H, `r1,${t},link_kind.gallery,Photos,2026-01-01,test,,,,`, `r2,${t},link_kind.gallery.from_tables,subject,2026-01-01,test,,,,`,
    `r3,${t},link_kind.gallery.to_tables,files,2026-01-01,test,,,,`, `r4,${t},link_kind.gallery.who_may,STAFF,2026-01-01,test,,,,`].join('\r\n') + '\r\n';
  const br = e.file('BLD-breeding_rule.csv');
  if (br.length) { br[0].content = rules; br[0].sheet = undefined; } else e.addFile('BLD-breeding_rule.csv', rules);
  const rows = [LINKS_H];
  for (let i = 0; i < rowsCount; i++) {
    const v = { id: 'lnk-test' + String(i).padStart(5, '0'), tenant_id: t, from_table: 'subject', from_id: 'sub-test-' + i, role: 'gallery',
      to_table: 'files', to_id: 'fil-' + i, from_date: '2026-11-01', source: 'test', set_by: 'sc-test', set_on: '2026-11-01', created_at: '2026-11-01T09:00:00Z' };
    rows.push(LINKS_H.map((h) => v[h] || ''));
  }
  e.addSheet('BLD-links.csv', rows);
  return e;
}
function post(e, action, fields) {
  n += 1;
  const body = { v: 1, request_id: 'req-speed-' + String(n).padStart(4, '0'), code: e.codes.staff, action, fields };
  return JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}
const fullReads = (e, title) => {
  const last = e.rows(title).length;
  return e.ranges.filter((r) => r[0] === title && r[1] === 1 && r[3] >= last).length;
};

test('link_end on a big links Sheet reads the whole tab once, not three times, and ends only that row @regression', () => {
  const e = env(400);
  const before = e.rows('BLD-links.csv').map((r) => r.slice());
  e.ranges.length = 0;
  const r = post(e, 'link_end', { id: 'lnk-test00200', to_date: '2026-11-20' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(fullReads(e, 'BLD-links.csv'), 1, 'whole-tab reads');
  const after = e.rows('BLD-links.csv'), to = LINKS_H.indexOf('to_date'), up = LINKS_H.indexOf('updated_at');
  assert.equal(after[201][to], '2026-11-20');
  assert.match(after[201][up], /Z$/);
  after.forEach((row, i) => { if (i !== 201) assert.deepEqual(row, before[i], 'row ' + i); });
});

test('one-row edit: a target row changed after the read is refused and nothing is written @regression', () => {
  const e = env(20);
  const orig = e.ctx.linksRead_;
  e.ctx.linksRead_ = () => { const rd = orig(); e.rows('BLD-links.csv')[6][LINKS_H.indexOf('note')] = 'changed meanwhile'; return rd; };
  const r = post(e, 'link_end', { id: 'lnk-test00005', to_date: '2026-11-20' });
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.code, 'CHANGED_DURING_WRITE');
  assert.equal(e.rows('BLD-links.csv')[6][LINKS_H.indexOf('to_date')], '');
});

test('one-row edit: a row added after the read is refused (row count checked)', () => {
  const e = env(20);
  const orig = e.ctx.linksRead_;
  e.ctx.linksRead_ = () => { const rd = orig(); e.rows('BLD-links.csv').push(LINKS_H.map(() => 'x')); return rd; };
  const r = post(e, 'link_end', { id: 'lnk-test00005', to_date: '2026-11-20' });
  assert.equal(r.code, 'CHANGED_DURING_WRITE', JSON.stringify(r));
});

test('one-row edit: a write that does not read back is undone and says so', () => {
  const e = env(20);
  e.breakSetValues = 'once'; e.breakTitle = 'BLD-links.csv';
  const before = e.rows('BLD-links.csv').map((r) => r.slice());
  const r = post(e, 'link_end', { id: 'lnk-test00005', to_date: '2026-11-20' });
  assert.equal(r.code, 'VERIFY_FAILED', JSON.stringify(r));
  assert.deepEqual(e.rows('BLD-links.csv'), before);
});

test('actions answered before the table save are timed and listed in ?status=1 @regression', () => {
  const e = env(5);
  const r = post(e, 'link_end', { id: 'lnk-test00001', to_date: '2026-11-20' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const st = JSON.parse(e.ctx.doGet({ parameter: { status: '1' } }).getContent());
  const t = st.lastSaveTimings[0];
  assert.equal(t.table, 'action:link_end');
  ['sign_in', 'lock_wait', 'work', 'total'].forEach((k) => assert.equal(typeof t[k], 'number', k));
  assert.ok(!/lnk-test|sub-test|fil-/.test(JSON.stringify(st.lastSaveTimings)), 'numbers and the action name only');
  // a refused early action is timed too
  post(e, 'link_end', { id: 'lnk-nope0000', to_date: '2026-11-20' });
  const st2 = JSON.parse(e.ctx.doGet({ parameter: { status: '1' } }).getContent());
  assert.equal(st2.lastSaveTimings.length, 2);
});
