'use strict';
// Visits part A (V9, 13 Nov 2026): visit types and visitor cards. Invented rows only.
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { standardEnv } = require('./harness');

const TYPE_H = 'id,tenant_id,type_key,name,role_code,default_hours,max_hours,rights,lists,fields,data_years,record_jobs,record_counts,email_code,needs_id_check,terms_id,active,effective_from,set_at,set_by,source';
const TAG_H = 'id,tenant_id,tag,kind,ref_id,active,made_at,made_by';
let n = 0;

function env(props, tagHeader) {
  const e = standardEnv({ props: Object.assign({ TABLE_ON_visit: 'true' }, props || {}) });
  e.addFile('BLD-visit_type.csv', TYPE_H + '\r\n');
  const tags = e.file('BLD-qr_tag.csv');
  const body = (tagHeader || TAG_H) + '\r\n';
  if (tags.length) { tags[0].content = body; tags[0].sheet = undefined; } else e.addFile('BLD-qr_tag.csv', body);
  return e;
}
function post(e, action, fields, code) {
  n += 1;
  const body = { v: 1, request_id: 'req-visit-' + String(n).padStart(4, '0'), code: code || e.codes.owner, action, fields };
  return JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}
const rows = (e, f) => e.file(f)[0].content.trim().split(/\r?\n/).slice(1);
const INSPECTOR = { type_key: 'inspector', name: 'Inspector', role_code: 'INSPECTOR', default_hours: '8', max_hours: '72',
  rights: 'view|review', lists: 'subject|microchip', fields: 'subject.name|microchip.chip_number:last4', record_jobs: '', record_counts: '' };

test('visit_type_save: owner code only, behind TABLE_ON_visit; one row by header name', () => {
  const off = env({ TABLE_ON_visit: '' });
  assert.equal(post(off, 'visit_type_save', INSPECTOR).code, 'TABLE_OFF');
  const e = env();
  assert.equal(post(e, 'visit_type_save', INSPECTOR, e.codes.staff).code, 'NOT_ALLOWED');
  const r = post(e, 'visit_type_save', Object.assign({ effective_from: '2026-10-15' }, INSPECTOR));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.result.id, /^vty/);
  assert.equal(r.result.new_version, false);
  const got = rows(e, 'BLD-visit_type.csv');
  assert.equal(got.length, 1);
  assert.match(got[0], /,inspector,Inspector,INSPECTOR,8,72,view\|review,subject\|microchip,subject\.name\|microchip\.chip_number:last4,,,,,,,true,2026-10-15,/);
});

test('visit_type_save: refuses bad rights, fields off the chosen lists, record jobs without record, default over max', () => {
  const e = env();
  const bad = (over, field) => {
    const r = post(e, 'visit_type_save', Object.assign({}, INSPECTOR, over));
    assert.equal(r.code, 'INVALID', field);
    assert.ok(r.fields[field], field + ' ' + JSON.stringify(r.fields));
  };
  bad({ rights: 'view|sign_off' }, 'rights');
  bad({ rights: 'review' }, 'rights');
  bad({ fields: 'health_screen.result' }, 'fields');
  bad({ record_jobs: 'temps' }, 'record_jobs');
  bad({ rights: 'view|record', record_jobs: 'temps', record_counts: 'water' }, 'record_counts');
  bad({ default_hours: '80' }, 'default_hours');
  bad({ type_key: 'Inspector!' }, 'type_key');
  assert.equal(rows(e, 'BLD-visit_type.csv').length, 0);
});

test('visit_type_save: the same key again is a new version, never back-dated behind a newer one', () => {
  const e = env();
  assert.ok(post(e, 'visit_type_save', Object.assign({}, INSPECTOR, { effective_from: '2026-10-01' })).ok);
  const v2 = post(e, 'visit_type_save', Object.assign({}, INSPECTOR, { max_hours: '48', effective_from: '2026-10-15' }));
  assert.equal(v2.ok, true, JSON.stringify(v2));
  assert.equal(v2.result.new_version, true);
  const back = post(e, 'visit_type_save', Object.assign({}, INSPECTOR, { effective_from: '2026-10-10' }));
  assert.equal(back.code, 'INVALID');
  assert.ok(back.fields.effective_from);
  assert.equal(rows(e, 'BLD-visit_type.csv').length, 2);
});

test('card_add: returns the tag once; qr_tag keeps only its sha256; duplicate live label refused', () => {
  const e = env();
  assert.equal(post(e, 'card_add', { label: 'Visitor 1' }, e.codes.staff).code, 'NOT_ALLOWED');
  const r = post(e, 'card_add', { label: 'Visitor 1' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.result.tag, /^vc[a-z2-9]{26}$/);
  const got = rows(e, 'BLD-qr_tag.csv');
  assert.equal(got.length, 1);
  assert.ok(got[0].indexOf(r.result.tag) < 0, 'the tag itself is never stored');
  const hash = crypto.createHash('sha256').update(r.result.tag).digest('hex');
  assert.match(got[0], new RegExp(',sha256:' + hash + ',visitor_card,Visitor 1,true,'));
  assert.equal(post(e, 'card_add', { label: 'Visitor 1' }).code, 'DUPLICATE');
  const two = post(e, 'card_add', { label: 'Visitor 2' });
  assert.notEqual(two.result.tag, r.result.tag);
});

test('card_add: a fixed visit type needs the fixed_type_id column and a real type', () => {
  const e = env();
  assert.equal(post(e, 'card_add', { label: 'Vet card', fixed_type_id: 'vty-x' }).code, 'HEADER_MISMATCH');
  const e2 = env({}, TAG_H + ',fixed_type_id');
  assert.equal(post(e2, 'card_add', { label: 'Vet card', fixed_type_id: 'vty-nope' }).code, 'NOT_FOUND');
  const t = post(e2, 'visit_type_save', INSPECTOR).result.id;
  const r = post(e2, 'card_add', { label: 'Vet card', fixed_type_id: t });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(rows(e2, 'BLD-qr_tag.csv')[0], new RegExp(',Vet card,true,[^,]*,[^,]*,' + t + '$'));
});

// ---- Part B: visit_give / visit_end / visit_extend (London clock in tests: 15/10/26 23:30 BST)
const LINK_H = 'id,tenant_id,code_id,label,ends,made_at,made_by,starts_at,ends_at,visit_type_id,person_id,visitor_name,organisation,sign_in_id,card_tag_id,rights,lists,record_jobs,record_counts,data_from_date,data_to_date,email_code,ended_at,ended_by,end_reason,id_checked_by,accompanied_by,tz';
function benv(props, linkHeader) {
  const e = env(props, TAG_H + ',fixed_type_id');
  e.addFile('BLD-inspect_link.csv', (linkHeader || LINK_H) + '\r\n');
  e.addFile('BLD-inspect_link_subject.csv', 'id,tenant_id,link_id,subject_id,from_date,to_date\r\n');
  e.addFile('BLD-inspect_link_field.csv', 'id,tenant_id,link_id,table_name,field_name,redaction\r\n');
  e.addFile('BLD-inspect_access.csv', 'id,tenant_id,link_id,code_id,table_name,rows,at\r\n');
  e.props.READ_ENABLED = 'true';
  return e;
}
function typeId(e, over) { return post(e, 'visit_type_save', Object.assign({}, INSPECTOR, { fields: 'subject.name', lists: 'subject' }, over || {})).result.id; }
const give = (e, over) => post(e, 'visit_give', Object.assign({ person_name: 'Pat Example', organisation: 'Council', rights: ['view', 'review'],
  fields: ['subject.name', 'subject.chip_number:last4'], subject_ids: ['sub-test-a'], hours: '3' }, over));
const links = (e) => e.ctx.store_read_('BLD-inspect_link.csv', true).records;

test('visit_give (link): rows, code once, window from hours, capped by the type; reads only its own rows', () => {
  const e = benv();
  const t = typeId(e);
  const st = post(e, 'visit_give', { visit_type_id: t, person_name: 'X', rights: ['view'], fields: ['subject.name'], hours: '1' }, e.codes.staff);
  assert.equal(st.code, 'NOT_ALLOWED');
  const r = give(e, { visit_type_id: t });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.result.code, /^[A-Z2-9]{16}$/);
  assert.equal(r.result.starts_at, '2026-10-15T23:30:00+01:00');
  assert.equal(r.result.ends_at, '2026-10-16T02:30:00+01:00');
  const L = links(e).filter((x) => x.id === r.result.link_id)[0];
  assert.equal(L.visitor_name, 'Pat Example');
  assert.equal(L.organisation, 'Council');
  assert.equal(L.rights, 'view|review');
  assert.equal(L.lists, 'subject');
  assert.equal(L.visit_type_id, t);
  assert.equal(L.ended_at, '');
  assert.equal(give(e, { visit_type_id: t, hours: '100' }).code, 'INVALID');   // the type's max is 72
  const s = e.ctx.sinkRead_({ v: 1, action: 'read', code: r.result.code, table: 'subject' });
  assert.deepEqual(Array.from(s.fields), ['id', 'name', 'chip_number']);
  assert.equal(s.rows.length, 1);
});

test('visit_give: refuses an old link header, a switched-off type, and fields off the allowed lists', () => {
  const old = benv({}, 'id,tenant_id,code_id,label,ends,made_at,made_by');
  assert.equal(give(old, { visit_type_id: typeId(old) }).code, 'HEADER_MISMATCH');
  const e = benv();
  const off = typeId(e, { type_key: 'old_kind', active: 'false' });
  assert.equal(give(e, { visit_type_id: off }).code, 'INVALID');
  const t = typeId(e);
  assert.equal(give(e, { visit_type_id: t, fields: ['score_x.total'] }).code, 'INVALID');
  assert.equal(give(e, { visit_type_id: t, person_name: '' }).code, 'INVALID');
  assert.equal(give(e, { visit_type_id: t, hours: '', starts_at: '', ends_at: '2026-10-15T20:00:00+01:00' }).code, 'INVALID');   // a past end
  assert.equal(links(e).length, 0);
});

test('visit_give (card): no code; one live window per card (CARD_IN_USE); a fixed card keeps its type', () => {
  const e = benv();
  const t = typeId(e), vet = typeId(e, { type_key: 'vet', name: 'Vet' });
  const card = post(e, 'card_add', { label: 'Visitor 1' }).result.tag_id;
  const fixed = post(e, 'card_add', { label: 'Vet card', fixed_type_id: vet }).result.tag_id;
  const r = give(e, { visit_type_id: t, card_tag_id: card });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.code, undefined);
  assert.equal(r.result.url, undefined);
  assert.equal(links(e)[0].code_id, '');
  assert.equal(links(e)[0].card_tag_id, card);
  assert.equal(give(e, { visit_type_id: t, card_tag_id: card }).code, 'CARD_IN_USE');
  assert.equal(give(e, { visit_type_id: t, card_tag_id: fixed }).code, 'INVALID');
  assert.equal(give(e, { visit_type_id: vet, card_tag_id: fixed }).ok, true);
  assert.equal(give(e, { visit_type_id: t, card_tag_id: 'qrt-nope' }).code, 'NOT_FOUND');
});

test('visit_end: needs a reason; kills a link code at once; keeps the planned end; never twice', () => {
  const e = benv();
  const r = give(e, { visit_type_id: typeId(e) });
  const id = r.result.link_id;
  assert.equal(post(e, 'visit_end', { link_id: id }).code, 'INVALID');
  const end = post(e, 'visit_end', { link_id: id, reason: 'Inspection finished' });
  assert.equal(end.ok, true, JSON.stringify(end));
  const L = links(e)[0];
  assert.equal(L.end_reason, 'Inspection finished');
  assert.equal(L.ended_at, '2026-10-15T23:30:00+01:00');
  assert.equal(L.ends_at, '2026-10-16T02:30:00+01:00');
  assert.throws(() => e.ctx.sinkRead_({ v: 1, action: 'read', code: r.result.code, table: 'subject' }));
  assert.equal(post(e, 'visit_end', { link_id: id, reason: 'again' }).code, 'ALREADY_ENDED');
  assert.equal(post(e, 'visit_end', { link_id: 'ilk-nope', reason: 'x' }).code, 'NOT_FOUND');
});

test('visit_extend: moves the end on the row and the code; capped by the type; not after it ended', () => {
  const e = benv();
  const r = give(e, { visit_type_id: typeId(e) });
  const id = r.result.link_id;
  assert.equal(post(e, 'visit_extend', { link_id: id, hours: '5' }).code, 'INVALID');   // reason needed
  const x = post(e, 'visit_extend', { link_id: id, hours: '5', reason: 'Running late' });
  assert.equal(x.ok, true, JSON.stringify(x));
  assert.equal(x.result.ends_at, '2026-10-16T04:30:00+01:00');
  assert.equal(links(e)[0].ends_at, '2026-10-16T04:30:00+01:00');
  e.nowMs += 4 * 3600000;   // after the first end, before the new one
  assert.equal(e.ctx.sinkRead_({ v: 1, action: 'read', code: r.result.code, table: 'subject' }).rows.length, 1);
  assert.equal(post(e, 'visit_extend', { link_id: id, hours: '100', reason: 'x' }).code, 'INVALID');
  post(e, 'visit_end', { link_id: id, reason: 'Done' });
  assert.equal(post(e, 'visit_extend', { link_id: id, hours: '1', reason: 'x' }).code, 'ALREADY_ENDED');
});
