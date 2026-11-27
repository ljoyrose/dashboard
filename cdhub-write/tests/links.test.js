'use strict';
// Record-to-record links (14 Nov 2026, the owner decision C). Invented records only.
const { test } = require('node:test');
const assert = require('node:assert');
const { standardEnv } = require('./harness');

const LINKS_H = 'id,tenant_id,from_table,from_id,role,to_table,to_id,from_date,to_date,source,set_by,set_on,sort,note,end_reason,created_at,updated_at';
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
  assert.match(row[15], /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);   // created_at in UTC
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
  assert.match(rs[0][16], /Z$/);
  assert.equal(rs[1][8], '');
  assert.equal(post(e, 'link_end', { id: b.result.id }).code, 'NOT_ALLOWED');
  assert.equal(post(e, 'link_end', { id: b.result.id, to_date: '2026-11-09' }, e.codes.owner).code, 'INVALID');
  const end = post(e, 'link_end', { id: b.result.id, to_date: '2026-11-12' }, e.codes.owner);
  assert.equal(end.ok, true, JSON.stringify(end));
  assert.equal(rows(e)[1][8], '2026-11-12');
  const again = post(e, 'link_end', { id: b.result.id }, e.codes.owner);
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.equal(again.result.already, true);
  assert.equal(rows(e)[1][8], '2026-11-12');
});

test('link_add: subjects is the dog list in BLD-subject.csv (live photo links say subjects)', () => {
  const e = env();
  const r = post(e, 'link_add', { from_table: 'subjects', from_id: 'sub-test-a', to_table: 'files', to_id: 'fil-1', role: 'gallery', from_date: '2026-11-14', source: 'test' }, e.codes.owner);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(rows(e)[0][2], 'subjects');
  assert.equal(rows(e)[0][3], 'sub-test-a');
  assert.equal(post(e, 'link_add', { from_table: 'subjects', from_id: 'sub-missing', to_table: 'files', to_id: 'fil-1', role: 'gallery', source: 'test' }, e.codes.owner).code, 'NOT_FOUND');
});

test('link_end: several gallery links end in one save, each with the same reason', () => {
  const e = env();
  const a = post(e, 'link_add', Object.assign(g('sub-test-a', 'fil-1'), { from_date: '2026-11-01' }));
  const b = post(e, 'link_add', Object.assign(g('sub-test-a', 'fil-2'), { from_date: '2026-11-02' }));
  assert.equal(a.ok && b.ok, true);
  const end = post(e, 'link_end', { reason: 'Removed in gallery edit', ends: [{ id: a.result.id, to_date: '2026-11-10' }, { id: b.result.id, to_date: '2026-11-11' }] });
  assert.equal(end.ok, true, JSON.stringify(end));
  assert.deepEqual(end.result.ids, [a.result.id, b.result.id]);
  const rs = rows(e);
  assert.equal(rs[0][8], '2026-11-10');
  assert.equal(rs[1][8], '2026-11-11');
  assert.equal(rs[0][14], 'Removed in gallery edit');
  assert.equal(rs[1][14], 'Removed in gallery edit');
});

test('link_end: an optional reason is kept in end_reason; nothing else changes', () => {
  const e = env();
  const a = post(e, 'link_add', Object.assign(g('sub-test-a', 'fil-1'), { from_date: '2026-11-01' }), e.codes.owner);
  const end = post(e, 'link_end', { id: a.result.id, to_date: '2026-11-12', reason: 'Left the scheme' }, e.codes.owner);
  assert.equal(end.ok, true, JSON.stringify(end));
  assert.equal(rows(e)[0][14], 'Left the scheme');
  assert.equal(rows(e)[0][13], '');
});

function inheritEnv(value, extraRules) {
  const e = env();
  const t = e.props.TENANT_ID;
  const br = e.file('BLD-breeding_rule.csv')[0];
  br.content += [`r20,${t},link_kind.enrolled_in,Enrolled in,2026-01-01,test,,,,`, `r21,${t},link_kind.enrolled_in.to_tables,score_schemes,2026-01-01,test,,,,`]
    .concat(value === undefined ? [] : [`r22,${t},link_kind.enrolled_in.inherit_at_birth,${value},2026-01-01,test,,,,`]).concat(extraRules || []).join('\r\n') + '\r\n';
  e.file('BLD-subject.csv')[0].content += `sub-test-p,${t},Pup\r\n`;
  e.addFile('BLD-score_schemes.csv', `id,tenant_id,name\r\nscs-1,${t},One\r\nscs-2,${t},Two\r\n`);
  e.addFile('BLD-litter.csv', `id,tenant_id,dam_subject_id,sire_subject_id\r\nltr-1,${t},sub-test-a,sub-test-b\r\n`);
  const en = (from, to) => post(e, 'link_add', { from_table: 'subject', from_id: from, to_table: 'score_schemes', to_id: to, role: 'enrolled_in', from_date: '2026-01-05', source: 'test' }, e.codes.owner);
  assert.equal(en('sub-test-a', 'scs-1').ok, true);
  assert.equal(en('sub-test-b', 'scs-1').ok, true);
  assert.equal(en('sub-test-b', 'scs-2').ok, true);
  return e;
}
const inherit = (e) => { const r = e.ctx.linkInheritAtBirth_('sub-test-p', 'ltr-1', '2026-11-10', { id: 'sc-test', who: 'Owner', role: 'OWNER' }, new Date(Date.UTC(2026, 10, 12, 10))); return Array.from(r); };
const pupLinks = (e) => rows(e).filter((r) => r[3] === 'sub-test-p');

test('inherit at birth: no row, none or blank = off; a list copies only those schemes, once even if both parents have it', () => {
  [undefined, 'none', ''].forEach((v) => { const e = inheritEnv(v); assert.deepEqual(inherit(e), []); assert.equal(pupLinks(e).length, 0); });
  const e = inheritEnv('scs-1');
  assert.equal(inherit(e).length, 1);
  const p = pupLinks(e);
  assert.equal(p.length, 1);
  assert.equal(p[0][6], 'scs-1');
  assert.equal(p[0][7], '2026-11-10');
  assert.match(p[0][9], /^inherited at birth from sub-test-/);
  assert.deepEqual(inherit(e), []);   // run again: already there
});

test('inherit at birth: * copies every open scheme; an ended parent link is not copied', () => {
  const e = inheritEnv('*');
  const lid = rows(e).find((r) => r[3] === 'sub-test-b' && r[6] === 'scs-2')[0];
  assert.equal(post(e, 'link_end', { id: lid, to_date: '2026-11-01', reason: 'Retired' }, e.codes.owner).ok, true);
  assert.equal(inherit(e).length, 1);
  assert.deepEqual(pupLinks(e).map((r) => r[6]), ['scs-1']);
  const e2 = inheritEnv('*');
  assert.equal(inherit(e2).length, 2);
});
