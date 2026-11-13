'use strict';
// Visits part A (V9, 13 Nov 2026): visit types and visitor cards. Invented rows only.
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { standardEnv, req: hreq, save: hsave } = require('./harness');

const TYPE_H = 'id,tenant_id,type_key,name,role_code,default_hours,max_hours,rights,lists,fields,data_years,record_jobs,record_counts,email_code,needs_id_check,terms_id,active,effective_from,set_at,set_by,source,grant_basis';
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
  assert.match(got[0], /,inspector,Inspector,INSPECTOR,8,72,view\|raise_finding,subject\|microchip,subject\.name\|microchip\.chip_number:last4,,,,,,,true,2026-10-15,/);
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
const LINK_H = 'id,tenant_id,code_id,label,ends,made_at,made_by,usable_from,usable_to,supersedes_id,visit_type_id,person_id,visitor_name,organisation,sign_in_id,card_tag_id,as_of_from,as_of_to,purpose_text,grant_basis,identity_assurance,id_checked_by,accompanied_by,retention_until,email_code,revoked_at,revoked_by,revoke_reason,tz';
function benv(props, linkHeader) {
  const e = env(props, TAG_H + ',fixed_type_id');
  e.addFile('BLD-inspect_link.csv', (linkHeader || LINK_H) + '\r\n');
  e.addFile('BLD-inspect_link_subject.csv', 'id,tenant_id,link_id,subject_id,from_date,to_date\r\n');
  e.addFile('BLD-inspect_link_field.csv', 'id,tenant_id,link_id,table_name,field_name,redaction\r\n');
  e.addFile('BLD-inspect_access.csv', 'id,tenant_id,link_id,code_id,table_name,rows,at\r\n');
  e.addFile('BLD-inspect_link_scope.csv', 'id,tenant_id,link_id,scope_item_type,disclosure_state,depth_limit,withhold_basis,is_active\r\n');
  e.addFile('BLD-inspect_link_right.csv', 'id,tenant_id,link_id,grant_right_code,scope_summary,counts_due,is_active\r\n');
  e.props.READ_ENABLED = 'true';
  return e;
}
function typeId(e, over) { return post(e, 'visit_type_save', Object.assign({}, INSPECTOR, { fields: 'subject.name', lists: 'subject' }, over || {})).result.id; }
const give = (e, over) => post(e, 'visit_give', Object.assign({ person_name: 'Pat Example', organisation: 'Council', rights: ['view', 'review'],
  fields: ['subject.name', 'subject.chip_number:last4'], subject_ids: ['sub-test-a'], hours: '3', purpose_text: 'Annual inspection' }, over));
const links = (e) => e.ctx.store_read_('BLD-inspect_link.csv', true).records;
const current = (e, root) => e.ctx.linkCurrent_(links(e), e.props.TENANT_ID)[root];
const rowsOf = (e, f, root) => e.ctx.store_read_(f, true).records.filter((x) => x.link_id === root);

test('visit_give (link): rows, code once, window from hours, capped by the type; reads only its own rows', () => {
  const e = benv();
  const t = typeId(e);
  const st = post(e, 'visit_give', { visit_type_id: t, person_name: 'X', rights: ['view'], fields: ['subject.name'], hours: '1', purpose_text: 'x' }, e.codes.staff);
  assert.equal(st.code, 'NOT_ALLOWED');
  const r = give(e, { visit_type_id: t });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.result.code, /^[A-Z2-9]{16}$/);
  assert.equal(r.result.usable_from, '2026-10-15T23:30:00+01:00');
  assert.equal(r.result.usable_to, '2026-10-16T02:30:00+01:00');
  const L = links(e).filter((x) => x.id === r.result.link_id)[0];
  assert.equal(L.visitor_name, 'Pat Example');
  assert.equal(L.organisation, 'Council');
  assert.equal(L.purpose_text, 'Annual inspection');
  assert.equal(L.grant_basis, 'voluntary');
  assert.equal(L.identity_assurance, 'none');
  assert.equal(L.visit_type_id, t);
  assert.equal(L.revoked_at, '');
  assert.deepEqual(rowsOf(e, 'BLD-inspect_link_scope.csv', L.id).map((x) => [x.scope_item_type, x.disclosure_state]), [['subject', 'record']]);
  assert.deepEqual(rowsOf(e, 'BLD-inspect_link_right.csv', L.id).map((x) => x.grant_right_code), ['view', 'raise_finding']);
  assert.equal(give(e, { visit_type_id: t, purpose_text: '' }).code, 'INVALID');   // a grant with no purpose is unreviewable
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
  assert.equal(give(e, { visit_type_id: t, hours: '', usable_from: '', usable_to: '2026-10-15T20:00:00+01:00' }).code, 'INVALID');   // a past end
  assert.equal(give(e, { visit_type_id: t, grant_basis: 'court_order' }).code, 'INVALID');   // not a grant_basis row yet
  const sl = 'code,label,match,source,group,level\r\nstatutory_duty,Statutory duty,,test,grant_basis,\r\n';
  const f = e.file('BLD-status_label.csv');
  if (f.length) { f[0].content = sl; f[0].sheet = undefined; } else e.addFile('BLD-status_label.csv', sl);
  const stat = typeId(e, { type_key: 'council', grant_basis: 'statutory_duty' });
  const g = give(e, { visit_type_id: stat });
  assert.equal(g.ok, true, JSON.stringify(g));
  assert.equal(links(e).filter((x) => x.id === g.result.link_id)[0].grant_basis, 'statutory_duty');   // the type's default
  assert.equal(links(e).length, 1);   // only the statutory one
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
  assert.equal(r.result.link_id, links(e)[0].id);
  assert.equal(give(e, { visit_type_id: t, card_tag_id: card }).code, 'CARD_IN_USE');
  assert.equal(give(e, { visit_type_id: t, card_tag_id: fixed }).code, 'INVALID');
  assert.equal(give(e, { visit_type_id: vet, card_tag_id: fixed }).ok, true);
  assert.equal(give(e, { visit_type_id: t, card_tag_id: 'qrt-nope' }).code, 'NOT_FOUND');
});

test('visit_end: needs a reason; kills a link code at once; a NEW row revokes it, the first row is untouched; never twice', () => {
  const e = benv();
  const r = give(e, { visit_type_id: typeId(e) });
  const id = r.result.link_id;
  assert.equal(post(e, 'visit_end', { link_id: id }).code, 'INVALID');
  const before = e.file('BLD-inspect_link.csv')[0].content;
  const end = post(e, 'visit_end', { link_id: id, reason: 'Inspection finished' });
  assert.equal(end.ok, true, JSON.stringify(end));
  assert.ok(e.file('BLD-inspect_link.csv')[0].content.startsWith(before), 'the first row is never edited');
  assert.equal(links(e).length, 2);
  const L = current(e, id);
  assert.equal(L.supersedes_id, id);
  assert.equal(L.revoke_reason, 'Inspection finished');
  assert.equal(L.revoked_at, '2026-10-15T23:30:00+01:00');
  assert.equal(L.usable_to, '2026-10-16T02:30:00+01:00');
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
  assert.equal(x.result.usable_to, '2026-10-16T04:30:00+01:00');
  assert.equal(current(e, id).usable_to, '2026-10-16T04:30:00+01:00');
  assert.equal(links(e)[0].usable_to, '2026-10-16T02:30:00+01:00');   // the first row keeps what was first granted
  e.nowMs += 4 * 3600000;   // after the first end, before the new one
  assert.equal(e.ctx.sinkRead_({ v: 1, action: 'read', code: r.result.code, table: 'subject' }).rows.length, 1);
  assert.equal(post(e, 'visit_extend', { link_id: id, hours: '100', reason: 'x' }).code, 'INVALID');
  post(e, 'visit_end', { link_id: id, reason: 'Done' });
  assert.equal(post(e, 'visit_extend', { link_id: id, hours: '1', reason: 'x' }).code, 'ALREADY_ENDED');
});

// ---- Part C: visit_open and reads with a card tag
const open = (e, f) => JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ v: 1, action: 'visit_open' }, f)) } }).getContent());
const cardRead = (e, t, table) => JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify({ v: 1, action: 'read', t, table }) } }).getContent());

test('visit_open (card): free card shows nothing; a scheduled visit says when it opens; live reads only its rows; WINDOW outside', () => {
  const e = benv();
  const t = typeId(e);
  const add = post(e, 'card_add', { label: 'Visitor 1' }).result;
  assert.deepEqual(open(e, { t: add.tag }).result, { state: 'free' });
  assert.equal(open(e, { t: 'vc' + 'a'.repeat(26) }).code, 'BAD_CODE');
  assert.equal(open(e, { t: 'nonsense' }).code, 'BAD_CODE');
  const g = give(e, { visit_type_id: t, card_tag_id: add.tag_id, hours: '', usable_from: '2026-10-16T09:00', usable_to: '2026-10-16T12:00' });
  assert.equal(g.ok, true, JSON.stringify(g));
  const soon = open(e, { t: add.tag }).result;
  assert.equal(soon.state, 'opens');
  assert.equal(soon.who, 'Pat Example');
  assert.equal(cardRead(e, add.tag, 'subject').code, 'WINDOW');
  e.nowMs = Date.parse('2026-10-16T10:00:00+01:00');
  const live = open(e, { t: add.tag }).result;
  assert.equal(live.state, 'live');
  assert.deepEqual(live.rights, ['view', 'raise_finding']);
  assert.deepEqual(live.record_jobs, []);
  const s = cardRead(e, add.tag, 'subject');
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.deepEqual(s.result.fields, ['id', 'name', 'chip_number']);
  assert.equal(s.result.rows.length, 1);
  assert.equal(cardRead(e, add.tag, 'health_screen').ok, false);   // not one of its lists
  const log = e.ctx.store_read_('BLD-inspect_access.csv', true).records;
  assert.equal(log.length, 1);
  assert.equal(log[0].code_id, 'card:' + add.tag_id);
  post(e, 'visit_end', { link_id: g.result.link_id, reason: 'Left early' });
  assert.equal(cardRead(e, add.tag, 'subject').code, 'WINDOW');
  assert.deepEqual(open(e, { t: add.tag }).result, { state: 'free' });   // the card can be given again
});

test('visit_open (link code): live, then ended after End now; a staff code is not a visit', () => {
  const e = benv();
  const g = give(e, { visit_type_id: typeId(e) });
  assert.equal(open(e, { c: g.result.code }).result.state, 'live');
  assert.equal(open(e, { c: e.codes.staff }).code, 'BAD_CODE');
  post(e, 'visit_end', { link_id: g.result.link_id, reason: 'Done' });
  assert.deepEqual(open(e, { c: g.result.code }).result, { state: 'ended' });
});

// ---- Part D: visit_review and visit_record
const FIND_H = 'id,tenant_id,inspection_id,declaration_id,outcome_id,authority,raised_on,wording_as_given,finding_kind,tenant_response,action_agreed,due_on,closed_on,evidence_document_id,notes,target_table,target_id,sign_in_id,raised_at,visit_id';
function denv() {
  const e = benv({ TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true' });
  e.addFile('BLD-finding.csv', FIND_H + '\r\n');
  const sl = 'code,label,match,source,group,level\r\nreview.ok,Seen,,test,review,green\r\nreview.ask,Needs a fix,,test,review,amber\r\nok,OK,,test,,\r\n';
  const f = e.file('BLD-status_label.csv');
  if (f.length) { f[0].content = sl; f[0].sheet = undefined; } else e.addFile('BLD-status_label.csv', sl);
  e.addFile('BLD-check_type.csv', e.ctx.TABLES.check_type.columns.join(',') + '\r\n');
  e.addFile('BLD-check_log.csv', e.ctx.TABLES.check_log.columns.join(',') + '\r\n');
  return e;
}
const act = (e, action, cred, fields) => { n += 1; return JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ v: 1, request_id: 'req-visitor-' + String(n).padStart(4, '0'), action, fields }, cred)) } }).getContent()); };
const addJob = (e, key) => { const r = hsave(e, hreq(e, { code: e.codes.owner, table: 'check_type', fields: { type_key: key, label: key, target: 'dog', effective_from: '2026-01-01' } })); assert.equal(r.ok, true, JSON.stringify(r)); return r.result.id; };

test('visit_review: only with the review right, only while live, a review word on one of its lists; target must be its dog', () => {
  const e = denv();
  const g = give(e, { visit_type_id: typeId(e) });
  const c = { code: g.result.code };
  const r = act(e, 'visit_review', c, { target_table: 'subject', target_id: 'sub-test-a', outcome_id: 'review.ask', note: 'Where is the vet letter?' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const row = e.ctx.store_read_('BLD-finding.csv', true).records[0];
  assert.equal(row.finding_kind, 'review');
  assert.equal(row.outcome_id, 'review.ask');
  assert.equal(row.authority, 'Council');
  assert.equal(row.visit_id, g.result.link_id);
  assert.equal(row.raised_at, '2026-10-15T23:30:00+01:00');
  const second = act(e, 'visit_review', c, { target_table: 'subject', outcome_id: 'review.ok' });
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(act(e, 'visit_review', c, { target_table: 'subject', outcome_id: 'ok' }).code, 'INVALID');           // not a review word
  assert.equal(act(e, 'visit_review', c, { target_table: 'health_screen', outcome_id: 'review.ok' }).code, 'INVALID');
  assert.equal(act(e, 'visit_review', c, { target_table: 'subject', target_id: 'sub-test-b', outcome_id: 'review.ok' }).code, 'NOT_FOUND');
  assert.equal(act(e, 'visit_review', { code: e.codes.staff }, { target_table: 'subject', outcome_id: 'review.ok' }).code, 'NOT_ALLOWED');
  const viewOnly = give(e, { visit_type_id: typeId(e), rights: ['view'] });
  assert.equal(act(e, 'visit_review', { code: viewOnly.result.code }, { target_table: 'subject', outcome_id: 'review.ok' }).code, 'NOT_ALLOWED');
  post(e, 'visit_end', { link_id: g.result.link_id, reason: 'Done' });
  assert.equal(act(e, 'visit_review', c, { target_table: 'subject', outcome_id: 'review.ok' }).ok, false);
  assert.equal(e.ctx.store_read_('BLD-finding.csv', true).records.length, 2);
});

test('visit_record: only jobs on the visit; through the normal check path; taken_by marks the visit', () => {
  const e = denv();
  const water = addJob(e, 'water'), feed = addJob(e, 'feed');
  const t = typeId(e, { type_key: 'helper', rights: 'view|record', record_jobs: 'water' });
  const add = post(e, 'card_add', { label: 'Helper 1' }).result;
  const g = give(e, { visit_type_id: t, card_tag_id: add.tag_id, rights: ['view', 'record'], record_jobs: ['water'] });
  assert.equal(g.ok, true, JSON.stringify(g));
  const opened = open(e, { t: add.tag }).result;
  assert.deepEqual(opened.record_jobs.map((j) => j.type_key), ['water']);
  const r = act(e, 'visit_record', { t: add.tag }, { check_type_id: water, subject_id: 'sub-test-a', outcome: 'ok' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.who, 'Pat Example');
  const row = e.ctx.store_read_('BLD-check_log.csv', true).records[0];
  assert.equal(row.taken_by, 'visit:' + g.result.link_id);
  assert.equal(row.visit_id, g.result.link_id);
  assert.equal(row.counts_due, 'false');
  const g2 = give(e, { visit_type_id: t, rights: ['view', 'record'], record_jobs: ['water'], record_counts: ['water'] });
  const r2 = act(e, 'visit_record', { code: g2.result.code }, { check_type_id: water, subject_id: 'sub-test-b', outcome: 'ok' });
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(e.ctx.store_read_('BLD-check_log.csv', true).records[1].counts_due, 'true');
  assert.equal(act(e, 'visit_record', { t: add.tag }, { check_type_id: feed, subject_id: 'sub-test-a', outcome: 'ok' }).code, 'NOT_ALLOWED');
  assert.equal(act(e, 'visit_record', { t: add.tag }, { check_type_id: water, subject_id: 'sub-test-a', outcome: 'concern' }).code, 'INVALID');   // the usual note rule
  const noRight = give(e, { visit_type_id: typeId(e) });
  assert.equal(act(e, 'visit_record', { code: noRight.result.code }, { check_type_id: water, outcome: 'ok' }).code, 'NOT_ALLOWED');
});
