'use strict';
/**
 * QR codes made when an item is added (the owner 15 Nov 2026, print-any-item job, Addendum 2 f-h). Invented rows only.
 * The rule is an owner row per item type: qr.on_add.<kind> (and qr.on_add.item.<kind_key>), dated, newest in force wins.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');
const Rules = require('../../cdhub/staff/lib/qr-rules.js');
const { backfill, main } = require('../tools/backfill-qr-tags.js');

const NOW = Date.UTC(2026, 10, 16, 10, 0, 0);
const QR_H = ['id', 'tenant_id', 'tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by'];
const ITEM_H = ['id', 'tenant_id', 'item_no', 'name', 'kind_key', 'make', 'model', 'serial_no', 'size', 'made_on', 'expires_on', 'photo', 'note', 'corrects_id', 'created_at', 'created_by'];
const KIND_H = ['id', 'tenant_id', 'kind_key', 'label', 'source', 'set_by', 'set_on'];
const rule = (key, value, from, to) => ['r-' + key + '-' + from, fx.TENANT, key, value, from, 'Pretend user rule', '', '', '', to || ''].join(',');

function env(rules, props) {
  const e = standardEnv({ nowMs: NOW, props: Object.assign({ TABLE_ON_qr_tag: 'true', TABLE_ON_items: 'true', TABLE_ON_item_kinds: 'true',
    TABLE_ON_subject_create: 'true', TABLE_ON_thermometer: 'true' }, props || {}) });
  e.addFile('BLD-breeding_rule.csv', [fx.BREEDING_RULE_HEADER.join(',')].concat(rules || []).join('\r\n') + '\r\n');
  e.addFile('BLD-qr_tag.csv', fx.headerOnly(QR_H));
  e.addFile('BLD-items.csv', fx.headerOnly(ITEM_H));
  e.addFile('BLD-item_kinds.csv', fx.headerOnly(KIND_H));
  e.addFile('BLD-thermometer.csv', fx.headerOnly(['id', 'tenant_id', 'name', 'area_id', 'made_at', 'made_by']));
  const T = e.props.TENANT_ID;
  const subj = e.file('BLD-subject.csv')[0];
  subj.content = 'id,tenant_id,name,sex,dob,size_band,coat_type,kind,neuter_status,source,species,breed,coat_colour_id,coat_pattern_id,nose_pigment_id,birth_litter_id,photo\r\n' +
    'sub-test-a,' + T + ',Pretend A,Female,2021-01-01,,,Adult,entire,seed,Dog,Pretend Breed,,,,,\r\n'; subj.sheet = undefined;
  e.addFile('BLD-species.csv', 'id,code,common_name,young_word,adult_female_word,adult_male_word,active\r\nsp-dog,dog,Dog,puppy,bitch,stud,yes\r\n');
  e.addFile('BLD-microchip.csv', 'id,tenant_id,subject_id,chip_number,source\r\n');
  const st = e.file('BLD-subject_status.csv')[0];
  st.content = 'id,tenant_id,subject_id,state,from_date,to_date,reason\r\nsst-a,' + T + ',sub-test-a,Active,,,\r\n'; st.sheet = undefined;
  return e;
}
const recs = (e, title) => { const f = e.file(title)[0];
  const [h, ...rows] = e.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === '')); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || '']))); };
let n = 0;
function createDog(e, name) {
  n += 1;
  const body = { v: 1, request_id: 'req-qr-' + String(n).padStart(5, '0'), code: e.codes.user, action: 'subject_create', fields: { name, sex: 'Female', species: 'dog', kind: 'Adult', dob: '2024-0' + (1 + (n % 8)) + '-01' } };
  return JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}
const user = (e, table, fields) => save(e, req(e, { code: e.codes.user, table, fields }));

test('add a dog with qr.on_add.subject = yes: one tag row for that dog, made in the same save', () => {
  const e = env([rule('qr.on_add.subject', 'yes', '2026-11-15')]);
  const r = createDog(e, 'Pretend New');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.qr, 'made');
  const tags = recs(e, 'BLD-qr_tag.csv');
  assert.equal(tags.length, 1);
  assert.deepEqual([tags[0].kind, tags[0].ref_id, tags[0].active], ['subject', r.result.id, 'true']);
  assert.match(tags[0].tag, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
});

test('rule no, or no rule at all: the dog is added and no tag is written', () => {
  for (const rules of [[rule('qr.on_add.subject', 'no', '2026-11-15')], []]) {
    const e = env(rules);
    const r = createDog(e, 'Pretend Quiet');
    assert.equal(r.ok, true); assert.equal(r.result.qr, 'no');
    assert.equal(recs(e, 'BLD-qr_tag.csv').length, 0);
  }
});

test('the QR switch off (TABLE_ON_qr_tag): nothing written, the add still saves', () => {
  const e = env([rule('qr.on_add.subject', 'yes', '2026-11-15')], { TABLE_ON_qr_tag: '' });
  const r = createDog(e, 'Pretend Off');
  assert.equal(r.ok, true); assert.equal(r.result.qr, 'off');
  assert.equal(recs(e, 'BLD-qr_tag.csv').length, 0);
});

test('a newer effective_from beats an older row; a row not yet started changes nothing', () => {
  const e = env([rule('qr.on_add.subject', 'yes', '2026-01-01'), rule('qr.on_add.subject', 'no', '2026-11-01'), rule('qr.on_add.subject', 'yes', '2026-12-01')]);
  assert.equal(createDog(e, 'Pretend Newer').result.qr, 'no');
  const e2 = env([rule('qr.on_add.subject', 'no', '2026-01-01'), rule('qr.on_add.subject', 'yes', '2026-11-10')]);
  assert.equal(createDog(e2, 'Pretend Newer Yes').result.qr, 'made');
  const e3 = env([rule('qr.on_add.subject', 'yes', '2026-01-01', '2026-11-01')]);   // ended by to_date
  assert.equal(createDog(e3, 'Pretend Ended').result.qr, 'no');
});

test('items: one item type can differ from the rest; a correction row keeps the first row\'s code', () => {
  const e = env([rule('qr.on_add.item', 'yes', '2026-11-15'), rule('qr.on_add.item.kettle', 'no', '2026-11-15')]);
  ['extinguisher', 'kettle'].forEach((k) => assert.equal(user(e, 'item_kinds', { kind_key: k, label: k, source: 'test' }).ok, true));
  const ext = user(e, 'items', { item_no: 'EXT-01', name: 'Pretend extinguisher', kind_key: 'extinguisher' });
  const ket = user(e, 'items', { item_no: 'K-01', name: 'Pretend kettle', kind_key: 'kettle' });
  assert.equal(ext.result.qr, 'made'); assert.equal(ket.result.qr, 'no');
  const fix = user(e, 'items', { item_no: 'EXT-01', name: 'Pretend extinguisher 2', kind_key: 'extinguisher', corrects_id: ext.result.id });
  assert.equal(fix.ok, true, JSON.stringify(fix)); assert.equal(fix.result.qr, undefined);
  const tags = recs(e, 'BLD-qr_tag.csv');
  assert.deepEqual(tags.map((t) => [t.kind, t.ref_id]), [['item', ext.result.id]]);
});

test('thermometers follow qr.on_add.thermometer', () => {
  const e = env([rule('qr.on_add.thermometer', 'yes', '2026-11-15')]);
  const r = user(e, 'thermometer', { name: 'Pretend probe', area_id: 'area-t1' });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.result.qr, 'made');
  assert.equal(recs(e, 'BLD-qr_tag.csv')[0].kind, 'thermometer');
});

test('an item that already has an active tag keeps it: no second tag', () => {
  const e = env([rule('qr.on_add.subject', 'yes', '2026-11-15')]);
  const T = e.props.TENANT_ID;
  e.file('BLD-qr_tag.csv')[0].content = QR_H.join(',') + '\r\nqrt-old,' + T + ',AAAABBBB,subject,sub-fixed,true,,\r\n';
  const got = e.ctx.qrOnAdd_('subject', 'sub-fixed', '', { who: 'test', id: 'test' }, new Date(NOW));
  assert.deepEqual(JSON.parse(JSON.stringify(got)), { qr: 'kept', tag: 'AAAABBBB' });
  assert.equal(recs(e, 'BLD-qr_tag.csv').length, 1);
});

test('the save script (QrTag.gs) and the shared browser helper (qr-rules.js) give the same answer', () => {
  const e = env([]);
  const R = [
    { tenant_id: fx.TENANT, rule_key: 'qr.on_add.item', value: 'yes', effective_from: '2026-01-01' },
    { tenant_id: fx.TENANT, rule_key: 'qr.on_add.item.kettle', value: 'no', effective_from: '2026-11-01' },
    { tenant_id: fx.TENANT, rule_key: 'qr.on_add.area', value: 'Yes', effective_from: '2026-12-01' },
    { tenant_id: 'ten-other', rule_key: 'qr.on_add.litter', value: 'yes', effective_from: '2026-01-01' },
    { tenant_id: fx.TENANT, rule_key: 'qr.on_add.subject', value: 'yes', effective_from: '2026-01-01', to_date: '2026-06-30' }];
  const cases = [['item', ''], ['item', 'kettle'], ['item', 'extinguisher'], ['area', ''], ['litter', ''], ['subject', ''], ['site', '']];
  ['2026-03-01', '2026-11-16', '2026-12-02'].forEach((day) => cases.forEach(([k, s]) => {
    assert.equal(e.ctx.qrRuleOn_(R, k, s, day, fx.TENANT), Rules.ruleOn(R, k, s, day, fx.TENANT), k + '.' + s + ' on ' + day);
  }));
});

test('back-fill: dry run gives counts only; applying its rows and running again adds 0 (idempotent)', () => {
  const T = fx.TENANT;
  const rules = [{ tenant_id: T, rule_key: 'qr.on_add.subject', value: 'yes', effective_from: '2026-11-15' },
    { tenant_id: T, rule_key: 'qr.on_add.item', value: 'yes', effective_from: '2026-11-15' },
    { tenant_id: T, rule_key: 'qr.on_add.area', value: 'no', effective_from: '2026-11-15' }];
  const lists = {
    subjects: [{ id: 'sub-1', tenant_id: T }, { id: 'sub-2', tenant_id: T }, { id: 'sub-gone', tenant_id: T }],
    status: [{ subject_id: 'sub-1', state: 'Active', from_date: '2026-01-01' }, { subject_id: 'sub-2', state: 'Active', from_date: '' },
      { subject_id: 'sub-gone', state: 'Active', from_date: '2025-01-01' }, { subject_id: 'sub-gone', state: 'Sold', from_date: '2026-02-01' }],
    areas: [{ id: 'area-1', tenant_id: T }],
    items: [{ id: 'itm-1', tenant_id: T, kind_key: 'ext' }, { id: 'itm-1b', tenant_id: T, kind_key: 'ext', corrects_id: 'itm-1' }]
  };
  const tags = [{ tag: 'AAAABBBB', kind: 'subject', ref_id: 'sub-2', active: 'true' }];
  let k = 0; const bytes = (len) => Array.from({ length: len }, () => (k++ * 7) % 256);
  const first = backfill(lists, rules, tags, { tenant: T, date: '2026-11-16', bytes });
  assert.deepEqual(first.report, { subject: { checked: 2, rule_no: 0, already: 1, add: 1 }, area: { checked: 1, rule_no: 1, already: 0, add: 0 }, item: { checked: 1, rule_no: 0, already: 0, add: 1 } });
  assert.deepEqual(first.rows.map((r) => [r.kind, r.ref_id]), [['subject', 'sub-1'], ['item', 'itm-1']]);
  assert.equal(new Set(first.rows.map((r) => r.tag).concat(['AAAABBBB'])).size, 3);
  const again = backfill(lists, rules, tags.concat(first.rows), { tenant: T, date: '2026-11-16', bytes });
  assert.equal(again.rows.length, 0);
  assert.equal(again.report.subject.add + again.report.item.add, 0);
});

test('back-fill command line: dry run prints counts only (no names, ids or tags) and writes nothing', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrbf-'));
  const w = (n, t) => { fs.writeFileSync(path.join(dir, n), t); return path.join(dir, n); };
  const T = fx.TENANT;
  const args = ['--rules', w('r.csv', 'id,tenant_id,rule_key,value,effective_from\r\nr1,' + T + ',qr.on_add.subject,yes,2026-11-01\r\n'),
    '--qr', w('q.csv', QR_H.join(',') + '\r\n'), '--subjects', w('s.csv', 'id,tenant_id,name\r\nsub-secret-id,' + T + ',Pretend Secret Name\r\n'),
    '--tenant', T, '--date', '2026-11-16'];
  let out = '', err = '';
  const r = main(args, (s) => { out += s; }, (s) => { err += s; });
  assert.equal(r.rows.length, 1);
  assert.deepEqual(JSON.parse(out), { subject: { checked: 1, rule_no: 0, already: 0, add: 1 } });
  assert.doesNotMatch(out + err, /sub-secret-id|Pretend Secret Name|qrt-/);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['q.csv', 'r.csv', 's.csv']);
  assert.throws(() => main(args.concat(['--out', path.join(dir, 'q.csv')]), () => {}, () => {}), /NEW file/);
});

