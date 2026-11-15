'use strict';
// Record-to-record links (14 Nov 2026, Lisa decision C). Invented records only.
const { test } = require('node:test');
const assert = require('node:assert');
const { standardEnv } = require('./harness');

const LINKS_H = 'id,tenant_id,from_table,from_id,role,to_table,to_id,from_date,to_date,source,set_by,set_on,sort,note,created_at,updated_at';
const RULE_H = 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date';
let n = 0;

function env(props) {
  const e = standardEnv({ props: Object.assign({ TABLE_ON_links: 'true' }, props || {}) });
  const t = e.props.TENANT_ID;
  const subj = 'id,tenant_id,name\r\nsub-test-a,' + t + ',Test A\r\nsub-test-b,' + t + ',Test B\r\n';
  const f = e.file('BLD-subject.csv');
  if (f.length) { f[0].content = subj; f[0].sheet = undefined; } else e.addFile('BLD-subject.csv', subj);
  e.addFile('BLD-files.csv', 'id,tenant_id,name\r\nfil-1,' + t + ',one.jpg\r\nfil-2,' + t + ',two.jpg\r\n');
  e.addFile('BLD-links.csv', LINKS_H + '\r\n');
  const rules = [RULE_H,
    `r1,${t},link_kind.gallery,Photos,2026-01-01,test,,,,`, `r2,${t},link_kind.gallery.from_tables,subject,2026-01-01,test,,,,`,
    `r3,${t},link_kind.gallery.to_tables,files,2026-01-01,test,,,,`, `r4,${t},link_kind.gallery.who_may,STAFF,2026-01-01,test,,,,`,
    `r5,${t},link_kind.main,Main photo,2026-01-01,test,,,,`, `r6,${t},link_kind.main.to_tables,files,2026-01-01,test,,,,`,
    `r7,${t},link_kind.main.max_per_from,1,2026-01-01,test,,,,`, `r8,${t},link_kind.old,Old,2026-01-01,test,,,,2026-02-01`].join('\r\n') + '\r\n';
  const br = e.file('BLD-breeding_rule.csv');
  if (br.length) { br[0].content = rules; br[0].sheet = undefined; } else e.addFile('BLD-breeding_rule.csv', rules);
  return e;
}
function post(e, action, fields, code) {
  n += 1;
  const body = { v: 1, request_id: 'req-links-' + String(n).padStart(4, '0'), code: code || e.codes.staff, action, fields };
  return JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}
const rows = (e) => e.file('BLD-links.csv')[0].content.trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
const g = (from_id, to_id, kind) => ({ from_table: 'subject', from_id, to_table: 'files', to_id, role: kind || 'gallery', source: 'test' });

test('link_add: behind its own switch; role from link_kind rule rows in force; who_may is the owner\'s rule row', () => {
  const off = env({ TABLE_ON_links: '' });
  assert.equal(post(off, 'link_add', g('sub-test-a', 'fil-1'), off.codes.owner).code, 'TABLE_OFF');
  const e = env();
  const r = post(e, 'link_add', Object.assign(g('sub-test-a', 'fil-1'), { from_date: '2026-11-14', sort: '2' }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.result.id, /^lnk/);
  const row = rows(e)[0];
  assert.deepEqual(row.slice(2, 9), ['subject', 'sub-test-a', 'gallery', 'files', 'fil-1', '2026-11-14', '']);
  assert.equal(row[12], '2');
  assert.match(row[14], /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);   // created_at in UTC
  assert.equal(post(e, 'link_add', g('sub-test-a', 'fil-2', 'main')).code, 'NOT_ALLOWED');   // blank who_may = owner only
  assert.equal(post(e, 'link_add', g('sub-test-a', 'fil-2', 'old'), e.codes.owner).code, 'INVALID');
  assert.equal(post(e, 'link_add', g('sub-test-a', 'fil-9'), e.codes.owner).code, 'NOT_FOUND');
  assert.equal(post(e, 'link_add', Object.assign(g('sub-test-a', 'fil-2'), { to_table: 'subject', to_id: 'sub-test-b' }), e.codes.owner).code, 'INVALID');
  assert.equal(post(e, 'link_add', g('sub-test-a', 'fil-1')).code, 'DUPLICATE');
});

test('link_add: max_per_from 1 (main) ends the old main in the same save; link_end fills to_date only', () => {
  const e = env();
  const a = post(e, 'link_add', Object.assign(g('sub-test-a', 'fil-1', 'main'), { from_date: '2026-11-01' }), e.codes.owner);
  assert.equal(a.ok, true, JSON.stringify(a));
  const b = post(e, 'link_add', Object.assign(g('sub-test-a', 'fil-2', 'main'), { from_date: '2026-11-10' }), e.codes.owner);
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.deepEqual(b.result.ended, [a.result.id]);
  const rs = rows(e);
  assert.equal(rs.length, 2);
  assert.equal(rs[0][8], '2026-11-09');
  assert.match(rs[0][15], /Z$/);
  assert.equal(rs[1][8], '');
  assert.equal(post(e, 'link_end', { id: b.result.id }).code, 'NOT_ALLOWED');
  assert.equal(post(e, 'link_end', { id: b.result.id, to_date: '2026-11-09' }, e.codes.owner).code, 'INVALID');
  const end = post(e, 'link_end', { id: b.result.id, to_date: '2026-11-12' }, e.codes.owner);
  assert.equal(end.ok, true, JSON.stringify(end));
  assert.equal(rows(e)[1][8], '2026-11-12');
  assert.equal(post(e, 'link_end', { id: b.result.id }, e.codes.owner).code, 'NOT_ALLOWED');
});
