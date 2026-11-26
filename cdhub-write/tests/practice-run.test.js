'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { standardEnv } = require('./harness');
const fx = require('./fixtures');
const inventory = require('../tools/save-inventory');

const NOW = Date.UTC(2026, 10, 14, 10, 0, 0);
const T = fx.TENANT;
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PEND = 'BLD-_pending.csv';
const RULE_H = fx.BREEDING_RULE_HEADER.join(',');
const H = {
  guest_reading: 'id,tenant_id,area_id,min_c,max_c,spot_c,precision_dp,period_start,taken_at,taken_by,read_method,camera_value_changed,mitigation_note,note',
  check_type: 'id,tenant_id,type_key,label,target,asks_item,item_label,asks_amount,amount_unit,note_label,note_required,asks_outcome,frequency,active,effective_from,source,note,set_at,set_by,every_days,group,includes,sop,evidence,site_scope,not_in_areas,only_in_areas,item_kind,only_groups',
  check_field: 'id,tenant_id,type_key,field_key,label,kind,choices,required,sort,active,effective_from,set_at,set_by,unit,limit_low,limit_high,source',
  check_value: 'id,tenant_id,check_log_id,check_field_id,field_key,value',
  check_log: 'id,tenant_id,check_type_id,area_id,subject_id,item,amount,outcome,happened_at,note,taken_at,taken_by,corrects_id,photo,how_recorded,litter_id,note_for_id,item_id,time_given,grant_id,counts_due,covered_ids,exceptions',
  weight: 'id,subject_id,performed_on,weight_kg,unit,body_condition_score,bcs_scale,source',
  vaccination: 'id,tenant_id,subject_id,event_kind,product,product_shorthand,diseases_covered,batch,batch_use_by,given_on,route,administered_by,practice,titre_result,titre_lab,titre_protective,next_due_on_card,next_due_source,certificate_media_id,source,ruling_needed,note,voided_on,voided_by',
  subject_link: 'id,tenant_id,subject_id,other_subject_id,kind,from_date,to_date,source,note,set_at,set_by',
  files: 'id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on,created_at,updated_at',
  links: 'id,tenant_id,from_table,from_id,role,to_table,to_id,from_date,to_date,source,set_by,set_on,sort,note,end_reason,created_at,updated_at',
  code_register: 'id,tenant_id,code_id,who,role,from_date,to_date,ended_by'
};

function put(env, title, text) {
  const f = env.file(title);
  if (f.length) { f[0].content = text; f[0].sheet = undefined; } else env.addFile(title, text);
}
const lines = (head, rows) => [head].concat(rows || []).join('\r\n') + '\r\n';
const header = (env, key) => put(env, env.ctx.TABLES[key].file, fx.headerOnly(env.ctx.TABLES[key].columns));
const rules = (env, rows) => put(env, 'BLD-breeding_rule.csv', lines(RULE_H, rows));
const typeRow = `ct-1,${T},bowls,Bowls,area,false,,false,,,false,true,,true,2026-01-01,test,,,,,,,,none,,,,`;

function fresh(on, props) {
  const p = Object.assign({ TABLE_ON_area_reading: '' }, props || {});
  (on || []).forEach((k) => { p['TABLE_ON_' + k] = 'true'; });
  const env = standardEnv({ nowMs: NOW, props: p });
  return env;
}

function sums(env) {
  const o = {};
  env.drive.filter((f) => !f.parent).forEach((f) => { o[f.title] = crypto.createHash('sha256').update(f.sheet ? JSON.stringify(f.sheet) : String(f.content)).digest('hex'); });
  return o;
}
function changed(before, after) {
  return Object.keys(Object.assign({}, before, after)).filter((t) => before[t] !== after[t]).sort();
}
const outside = (env) => (env.photos || []).length + (env.stored || []).length;

let n = 0;
function post(env, body) {
  n += 1;
  const b = Object.assign({ v: 1, request_id: 'req-practice-' + String(n).padStart(5, '0') }, body);
  return JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(b) } }).getContent());
}
const switchesOn = (env) => Object.keys(env.props).filter((k) => /^TABLE_ON_/.test(k) && env.props[k] === 'true').sort();

const CASES = [
  { id: 'area_reading', on: ['area_reading'], role: 'staff', writes: ['BLD-area_reading.csv'], read: 'area_reading',
    body: () => ({ table: 'area_reading', action: 'add', fields: { area_id: 'area-t1', min_c: '19.5', max_c: '22.0' } }) },
  { id: 'guest_reading', on: ['guest_reading'], role: 'guest', writes: ['BLD-guest_reading.csv'], read: 'guest_reading',
    seed: (env) => put(env, 'BLD-guest_reading.csv', lines(H.guest_reading)),
    body: () => ({ table: 'guest_reading', action: 'add', fields: { area_id: 'area-t1', min_c: '19.5', max_c: '22.0' } }) },
  { id: 'sensor_reading', on: ['sensor_reading'], role: 'user', writes: ['BLD-sensor_reading.csv'], read: 'sensor_reading',
    seed: (env) => header(env, 'sensor_reading'),
    body: () => ({ table: 'sensor_reading', action: 'add', fields: { area_id: 'area-t1', day: '2026-11-13', min_c: '18.0', max_c: '23.0', samples: '96', source: 'invented sensor' } }) },
  { id: 'thermometer', on: ['thermometer'], role: 'user', writes: ['BLD-thermometer.csv'], read: 'thermometer',
    seed: (env) => header(env, 'thermometer'),
    body: () => ({ table: 'thermometer', action: 'add', fields: { name: 'Thermo 1', area_id: 'area-t1' } }) },
  { id: 'requirement', on: ['requirement'], role: 'user', writes: ['BLD-requirement.csv'], read: 'requirement',
    seed: (env) => header(env, 'requirement'),
    body: () => ({ table: 'requirement', action: 'add', fields: { need_type: 'temperature_log', target_table: 'area', target_id: 'area-t1', from_date: '2026-11-01' } }) },
  { id: 'area_link', on: ['area_link'], role: 'user', writes: ['BLD-area_link.csv'], read: 'area_link',
    seed: (env) => header(env, 'area_link'),
    body: () => ({ table: 'area_link', action: 'add', fields: { from_area_id: 'area-t1', to_area_id: 'area-t2', from_date: '2026-11-01' } }) },
  { id: 'check_type', on: ['check_type'], role: 'user', writes: ['BLD-check_type.csv'], read: 'check_type',
    seed: (env) => put(env, 'BLD-check_type.csv', lines(H.check_type)),
    body: () => ({ table: 'check_type', action: 'add', fields: { type_key: 'bowls', label: 'Bowls', target: 'area', effective_from: '2026-11-01' } }) },
  { id: 'check_field', on: ['check_field'], role: 'user', writes: ['BLD-check_field.csv'], read: 'check_field',
    seed: (env) => { put(env, 'BLD-check_type.csv', lines(H.check_type, [typeRow])); put(env, 'BLD-check_field.csv', lines(H.check_field)); },
    body: () => ({ table: 'check_field', action: 'add', fields: { type_key: 'bowls', field_key: 'water', label: 'Water', kind: 'text', effective_from: '2026-11-01' } }) },
  { id: 'check_value', on: ['check_value', 'check_log'], role: 'staff', writes: ['BLD-check_log.csv', 'BLD-check_value.csv'], read: 'check_value',
    seed: (env) => {
      put(env, 'BLD-check_type.csv', lines(H.check_type, [typeRow]));
      put(env, 'BLD-check_field.csv', lines(H.check_field, [`cf-1,${T},bowls,water,Water,text,,false,1,true,2026-01-01,,,,,,test`]));
      put(env, 'BLD-check_log.csv', lines(H.check_log)); put(env, 'BLD-check_value.csv', lines(H.check_value));
    },
    body: () => ({ table: 'check_log', action: 'add', fields: { check_type_id: 'ct-1', area_id: 'area-t1', outcome: 'ok' }, values: { water: 'fresh' } }) },
  { id: 'check_log', on: ['check_log'], role: 'staff', writes: ['BLD-check_log.csv'], read: 'check_log',
    seed: (env) => { put(env, 'BLD-check_type.csv', lines(H.check_type, [typeRow])); put(env, 'BLD-check_log.csv', lines(H.check_log)); },
    body: () => ({ table: 'check_log', action: 'add', fields: { check_type_id: 'ct-1', area_id: 'area-t1', outcome: 'ok' } }) },
  { id: 'readings', on: ['readings'], role: 'staff', writes: ['BLD-readings.csv'],
    seed: (env) => {
      header(env, 'readings');
      put(env, 'BLD-reading_kinds.csv', lines('id,tenant_id,kind_key,label,unit_id,value_shape,precision_dp,source,set_by,set_on', [`rk-earth,${T},earth_bond,Earth bond,ohm,single,2,test,,`]));
      put(env, 'BLD-reading_limits.csv', lines('id,tenant_id,kind_id,scope_table,scope_id,low,high,label,from_date,to_date,source,set_by,set_on', [`rl-earth,${T},rk-earth,,,,0.1,,2025-01-01,,test,,`]));
      put(env, 'BLD-items.csv', lines('id,tenant_id,item_no,name', [`itm-1,${T},01,Kettle`]));
      put(env, 'BLD-check_log.csv', lines('id,tenant_id,check_type_id,item_id', [`clg-1,${T},ct-pat,itm-1`]));
    },
    body: () => ({ table: 'readings', action: 'add', fields: { kind_id: 'rk-earth', item_id: 'itm-1', check_log_id: 'clg-1', value: '0.05', limit_id: 'rl-earth', taken_at: '2026-11-14T09:30:00+00:00', how_entered: 'typed', source: 'staff' } }) },
  { id: 'items', on: ['items'], role: 'user', writes: ['BLD-items.csv'], read: 'items',
    seed: (env) => { header(env, 'items'); put(env, 'BLD-item_kinds.csv', lines('id,tenant_id,kind_key,label,source,set_by,set_on', [`ik-1,${T},appliance,Appliance,test,,`])); },
    body: () => ({ table: 'items', action: 'add', fields: { item_no: '01', name: 'Kettle', kind_key: 'appliance' } }) },
  { id: 'item_kinds', on: ['item_kinds'], role: 'user', writes: ['BLD-item_kinds.csv'], read: 'item_kinds',
    seed: (env) => header(env, 'item_kinds'),
    body: () => ({ table: 'item_kinds', action: 'add', fields: { kind_key: 'appliance', label: 'Appliance' } }) },
  { id: 'occupancy', on: ['occupancy'], role: 'staff', writes: ['BLD-occupancy.csv'], read: 'occupancy',
    body: () => ({ table: 'occupancy', action: 'add', fields: { subject_id: 'sub-test-e', area_id: 'area-t1' } }) },
  { id: 'occupancy_out', on: ['occupancy_out'], role: 'staff', writes: [PEND], read: 'occupancy',
    body: () => ({ table: 'occupancy_out', action: 'add', fields: { subject_id: 'sub-test-a', off_site_kind: 'temporary' } }) },
  { id: 'area_access', on: ['area_access'], role: 'staff', writes: ['BLD-area_access.csv'], read: 'area_access',
    seed: (env) => header(env, 'area_access'),
    body: () => ({ table: 'area_access', action: 'add', fields: { area_id: 'area-t1', access_type: 'free' } }) },
  { id: 'qr_tag', on: ['qr_tag'], role: 'user', writes: ['BLD-qr_tag.csv'], read: 'qr_tag',
    seed: (env) => header(env, 'qr_tag'),
    body: () => ({ table: 'qr_tag', action: 'add', fields: { tag: 'TAG-0001', kind: 'area', ref_id: 'area-t1' } }) },
  { id: 'occupancy_check', on: ['occupancy_check'], role: 'staff', writes: ['BLD-occupancy_check.csv'], read: 'occupancy_check',
    body: () => ({ table: 'occupancy_check', action: 'add', fields: { dog_ids: 'sub-test-a' } }) },
  { id: 'breeding_rule', on: ['breeding_rule'], role: 'user', writes: ['BLD-breeding_rule.csv'], read: 'breeding_rule',
    seed: (env) => rules(env, []),
    body: () => ({ table: 'breeding_rule', action: 'add', fields: { rule_key: 'practice.example', value: '1', effective_from: '2026-11-01' } }) },
  { id: 'person', on: ['person'], role: 'user', writes: [PEND],
    body: () => ({ table: 'person', action: 'add', fields: { full_name: 'Invented Buyer' } }) },
  { id: 'household', on: ['household'], role: 'user', writes: [PEND], seed: (env) => header(env, 'household'),
    body: () => ({ table: 'household', action: 'add', fields: { name: 'Invented household', primary_person_id: 'per-test-1', stage: 'enquiry' } }) },
  { id: 'household_member', on: ['household_member'], role: 'user', writes: [PEND],
    seed: (env) => { put(env, 'BLD-household.csv', lines('id,tenant_id,name,primary_person_id,stage', [`hh-1,${T},Invented household,per-test-1,enquiry`])); header(env, 'household_member'); },
    body: () => ({ table: 'household_member', action: 'add', fields: { household_id: 'hh-1', person_id: 'per-test-1' } }) },
  { id: 'subject_user', on: ['subject_user'], role: 'user', writes: [PEND],
    seed: (env) => { put(env, 'BLD-household.csv', lines('id,tenant_id,name,primary_person_id,stage', [`hh-1,${T},Invented household,per-test-1,enquiry`])); header(env, 'subject_user'); },
    body: () => ({ table: 'subject_user', action: 'add', fields: { subject_id: 'sub-test-a', person_id: 'per-test-1', household_id: 'hh-1', role: 'assigned' } }) },
  { id: 'sale', on: ['sale'], role: 'user', writes: [PEND],
    seed: (env) => { put(env, 'BLD-household.csv', lines('id,tenant_id,name,primary_person_id,stage', [`hh-1,${T},Invented household,per-test-1,enquiry`])); header(env, 'sale'); },
    body: () => ({ table: 'sale', action: 'add', fields: { subject_id: 'sub-test-a', person_id: 'per-test-1', household_id: 'hh-1' } }) },
  { id: 'weighing', on: ['weighing'], role: 'staff', writes: ['BLD-weight.csv'], read: 'weight',
    seed: (env) => put(env, 'BLD-weight.csv', lines(H.weight)),
    body: () => ({ action: 'weighing', fields: { subject_id: 'sub-test-a', performed_on: '2026-11-13', weight_kg: '12.4' } }) },
  { id: 'vaccination', on: ['vaccination'], role: 'staff', writes: ['BLD-vaccination.csv'],
    seed: (env) => put(env, 'BLD-vaccination.csv', lines(H.vaccination)),
    body: () => ({ action: 'vaccination', fields: { subject_id: 'sub-test-a', given_on: '2026-11-01', product: 'Invented vaccine' } }) },
  { id: 'dog_details', on: ['dog_details'], role: 'user', writes: ['BLD-subject.csv'], read: 'subject',
    body: () => ({ action: 'dog_details', fields: { subject_id: 'sub-test-a', name: 'Test A renamed' } }) },
  { id: 'subject_create', on: ['subject_create'], role: 'user', writes: ['BLD-subject.csv', 'BLD-subject_status.csv'], read: 'subject',
    seed: (env) => {
      put(env, 'BLD-subject.csv', lines('id,tenant_id,name,sex,dob,species,kind,source,neuter_status,breed,coat_type,coat_colour_id,coat_pattern_id,nose_pigment_id,birth_litter_id,size_band',
        [`sub-test-a,${T},Test A,Female,2020-01-01,dog,adult,test,entire,,,,,,,`]));
      put(env, 'BLD-species.csv', lines('id,tenant_id,code,common_name,adult_female_word,adult_male_word,young_word,active', [`sp-dog,${T},dog,dog,Female,Male,puppy,yes`]));
    },
    body: () => ({ action: 'subject_create', fields: { name: 'Invented Dog', sex: 'Male', species: 'dog', kind: 'adult', dob: '2024-01-01' } }) },
  { id: 'subject_link', on: ['subject_link'], role: 'user', writes: ['BLD-subject_link.csv'], read: 'subject_link',
    seed: (env) => { put(env, 'BLD-subject_link.csv', lines(H.subject_link)); rules(env, [`r1,${T},link_kind.bff,BFFs,2026-01-01,test,,,,`]); },
    body: () => ({ action: 'subject_link', fields: { subject_id: 'sub-test-a', other_subject_id: 'sub-test-b', kind: 'bff' } }) },
  { id: 'files', on: ['files'], role: 'user', writes: ['BLD-files.csv'], props: { FILES_FOLDER_ID: 'FOLDER-FILES' }, outside: 1,
    seed: (env) => { put(env, 'BLD-files.csv', lines(H.files)); rules(env, [`r1,${T},file.types,image/png,2026-01-01,test,,,,`, `r2,${T},file.max_bytes,5000,2026-01-01,test,,,,`]); },
    body: () => ({ action: 'file_add', fields: { kind: 'photo', mime: 'image/png', name: 'one.png', data_base64: PNG } }) },
  { id: 'links', on: ['links'], role: 'user', writes: ['BLD-links.csv'], read: 'links',
    seed: (env) => {
      put(env, 'BLD-links.csv', lines(H.links)); put(env, 'BLD-files.csv', lines('id,tenant_id,name', [`fil-1,${T},one.jpg`]));
      rules(env, [`r1,${T},link_kind.gallery,Photos,2026-01-01,test,,,,`]);
    },
    body: () => ({ action: 'link_add', fields: { from_table: 'subject', from_id: 'sub-test-a', to_table: 'files', to_id: 'fil-1', role: 'gallery' } }) },
  { id: 'score_save', on: ['score_assessment'], role: 'user', writes: ['BLD-score_assessment.csv', 'BLD-score_line.csv'],
    seed: (env) => {
      put(env, 'BLD-score_assessment.csv', lines('id,tenant_id,subject_id,scheme_id,period,verdict,points_earned,points_available,points_unverified,unknown_count,status,calculated_at,calculated_by,replaces_id'));
      put(env, 'BLD-score_line.csv', lines('id,tenant_id,assessment_id,criterion_id,label_then,evidence_table,evidence_record_id,answer_then,points,points_max,gate_outcome,unknown_reason,judged_at,judged_by,rule_version_then'));
      put(env, 'BLD-score_scheme.csv', lines('id,tenant_id,name', [`sch-test,${T},Test scheme`]));
    },
    body: () => ({ action: 'score_save', fields: { subject_id: 'sub-test-a', scheme_id: 'sch-test', period: '2026-10-01', verdict: 'unverified',
      points_earned: '0', points_available: '10', lines: [{ criterion_id: 'c-test', label_then: 'Test', points_max: '10', unknown_reason: 'no_record' }] } }) },
  { id: 'dog_photo', on: [], role: 'staff', writes: ['BLD-subject.csv'], read: 'subject', props: { DOG_PHOTOS_FOLDER_ID: 'FOLDER-PHOTOS' }, outside: 1,
    seed: (env) => put(env, 'BLD-subject.csv', lines('id,tenant_id,name,photo', [`sub-test-a,${T},Test A,`])),
    body: () => ({ action: 'dog_photo', fields: { subject_id: 'sub-test-a', mime: 'image/png', image_base64: PNG } }) }
];

const MANUAL = {
  check_setting: 'user check settings, dated rows, floors in tests/check-settings.test.js',
  retention_setting: 'how long check records are kept, at least 6 years (tests/check-settings.test.js)',
  code_register: 'user page (Google sign-in, not a code): exercised below with the harness user session',
  code_vaults: 'sealed text only, made in the browser from the vault password (tests/code-vault.test.js and the code-vault browser specs); a practice row would need a real sealed value',
  staff: 'proposed table: refused whatever its switch says (tested below)',
  parties: 'proposed table (BLD schema v2, 15 Nov 2026): refused whatever its switch says (tests/schema-v2.test.js)',
  products: 'proposed table (BLD schema v2, 15 Nov 2026): refused whatever its switch says (tests/schema-v2.test.js)',
  lots: 'proposed table (BLD schema v2, 15 Nov 2026): refused whatever its switch says (tests/schema-v2.test.js)',
  stock_movements: 'proposed table (BLD schema v2, 15 Nov 2026): refused whatever its switch says (tests/schema-v2.test.js)',
  courses: 'proposed table (BLD schema v2, 15 Nov 2026): refused whatever its switch says (tests/schema-v2.test.js)',
  doses: 'proposed table (BLD schema v2, 15 Nov 2026): refused whatever its switch says (tests/schema-v2.test.js)',
  prescriptions: 'proposed table (BLD schema v2, 15 Nov 2026): refused whatever its switch says (tests/schema-v2.test.js)',
  product_dose_bands: 'proposed table (BLD schema v2, 15 Nov 2026): refused whatever its switch says (tests/schema-v2.test.js)',
  certificate_kinds: 'proposed table (BLD schema v2, 15 Nov 2026): refused whatever its switch says (tests/schema-v2.test.js)',
  certificates: 'proposed table (BLD schema v2, 15 Nov 2026): refused whatever its switch says (tests/schema-v2.test.js)',
  user_edit: 'user page (Google sign-in); covered by tests/sink.test.js and tests/area-link.test.js',
  record_edit: 'edit / archive / delete with a code, OFF (RECORD_EDIT_ON); covered by tests/area-link.test.js',
  approve: 'user page (Google sign-in); applies a queued row (tests/sink.test.js); R2 test below',
  inspector: 'user page (Google sign-in) plus inspector reads; covered by tests/inspect-link.test.js',
  backup: 'editor timer; copies only, never the live files (tests/sink.test.js)',
  create_empty: 'editor Run with ALLOW_CREATE; makes header-only files only (tests/sink.test.js)'
};

function codeFor(env, role) {
  if (role === 'user') return env.codes.user;
  if (role === 'guest') return env.guest || (env.guest = env.ctx.adminAddGuestCode());
  return env.codes.staff;
}

test('practice run: every write path in the inventory has a practice case or a stated manual reason', () => {
  const ids = inventory.rows().map((r) => r.id);
  const covered = CASES.map((c) => c.id).concat(Object.keys(MANUAL));
  assert.deepEqual(ids.filter((id) => covered.indexOf(id) < 0), []);
  assert.deepEqual(covered.filter((id) => ids.indexOf(id) < 0), []);
});

CASES.forEach((c) => {
  test('practice run: ' + c.id + ' with only its own switch on', () => {
    const env = fresh(c.on, c.props);
    if (c.seed) c.seed(env);
    assert.deepEqual(switchesOn(env), c.on.map((k) => 'TABLE_ON_' + k).sort());
    const code = codeFor(env, c.role);

    const s0 = sums(env), o0 = outside(env);
    const bad = post(env, Object.assign(c.body(env), { code: 'ZZZZZZZZZZ' }));
    assert.equal(bad.ok, false); assert.equal(bad.code, 'BAD_CODE', JSON.stringify(bad));
    const none = post(env, c.body(env));
    assert.equal(none.ok, false); assert.equal(none.code, 'NO_CODE', JSON.stringify(none));
    assert.deepEqual(changed(s0, sums(env)), []); assert.equal(outside(env), o0);

    const r = post(env, Object.assign(c.body(env), { code }));
    assert.equal(r.ok, true, c.id + ': ' + JSON.stringify(r));
    assert.deepEqual(changed(s0, sums(env)), c.writes.slice().sort());
    assert.equal(outside(env) - o0, c.outside || 0);

    env.props.READ_ENABLED = 'true';
    put(env, 'BLD-field_visibility.csv', fx.VIS_HEADER + '\r\n');
    const s1 = sums(env);
    let res;
    try { res = { ok: true, result: env.ctx.sinkRead_({ v: 1, action: 'read', code: env.codes.staff, table: c.read || c.id }) }; }
    catch (e) { res = env.ctx.errorBody_(e); }
    assert.equal(res.ok, false, c.id + ' read: ' + JSON.stringify(res));
    assert.ok(['NOT_ALLOWED', 'FILE_NOT_ALLOWED'].indexOf(res.code) >= 0, res.code);
    assert.deepEqual(changed(s1, sums(env)), []);
  });
});

test('practice run: code_register (user page) writes only the register and its queue note; not signed in = nothing', () => {
  const env = fresh(['code_register']);
  put(env, 'BLD-code_register.csv', lines(H.code_register));
  const s0 = sums(env), reg0 = env.props.STAFF_REGISTRY;
  env.email = 'someone@example.test';
  assert.equal(env.ctx.ui_issueCode('Invented Person', 'STAFF').ok, false);
  assert.deepEqual(changed(s0, sums(env)), []); assert.equal(env.props.STAFF_REGISTRY, reg0);
  env.email = 'user@example.test';
  const r = env.ctx.ui_issueCode('Invented Person', 'STAFF');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(changed(s0, sums(env)), [PEND, 'BLD-code_register.csv'].sort());
});

test('practice run: the staff table stays refused, even with TABLE_ON_staff, and would need its own switch', () => {
  const env = fresh([], { TABLE_ON_staff: 'true' });
  put(env, 'BLD-staff.csv', fx.headerOnly(fx.STAFF_HEADER));
  const s0 = sums(env);
  const fields = { person_id: 'per-test-1', role: 'STAFF', employment: 'part_time', started_on: '2026-11-01' };
  const r = post(env, { table: 'staff', action: 'add', code: env.codes.user, fields });
  assert.equal(r.code, 'FILE_NOT_ALLOWED');
  assert.deepEqual(changed(s0, sums(env)), []);
  const env2 = fresh([]);
  put(env2, 'BLD-staff.csv', fx.headerOnly(fx.STAFF_HEADER));
  env2.ctx.TABLES.staff = env2.ctx.PROPOSED_TABLES.staff;
  assert.equal(post(env2, { table: 'staff', action: 'add', code: env2.codes.user, fields }).code, 'TABLE_OFF');
});

test('status=1: no side effects (no waiting move applied, no file written) and every switch by name, never a value', () => {
  const env = fresh(['occupancy'], { DOG_PHOTOS_FOLDER_ID: 'FOLDER-PHOTOS', TABLE_ON_files: 'true' });
  assert.equal(post(env, { table: 'occupancy', action: 'add', code: env.codes.staff, fields: { subject_id: 'sub-test-e', area_id: 'area-t1' } }).ok, true);
  const q = { event_id: 'evt-x', pending_id: 'pnd-x', event: 'queued', at: '2026-11-14T10:00:00+00:00', by: 'Sam Staff', role: 'STAFF',
    target_file: 'BLD-occupancy.csv', kind: 'new', row_id: 'occ-x', corrects_id: '', note: '',
    payload_json: JSON.stringify({ id: 'occ-x', tenant_id: T, subject_id: 'sub-test-b', area_id: 'area-t2', off_site_kind: '', moved_in: '2026-11-14', moved_out: '', classification: '', classification_note: '' }), result: '' };
  const pf = env.file(PEND)[0];
  pf.content += env.ctx.csvLine_(fx.PENDING_HEADER.map((h) => q[h])) + '\r\n';
  const s0 = sums(env), w0 = env.writes.length, props0 = JSON.stringify(env.props);
  const st = JSON.parse(env.ctx.doGet({ parameter: { status: '1' } }).getContent());
  assert.deepEqual(changed(s0, sums(env)), []); assert.equal(env.writes.length, w0); assert.equal(JSON.stringify(env.props), props0);
  assert.equal(st.ok, true); assert.equal(st.sideEffectFree, true); assert.equal(st.version, env.ctx.BLD.VERSION);
  assert.ok(st.tables.some((t) => t.key === 'occupancy' && t.on === true));
  const by = Object.fromEntries(st.switches.map((s) => [s.name, s]));
  ['TABLE_ON_weighing', 'TABLE_ON_vaccination', 'TABLE_ON_dog_details', 'TABLE_ON_subject_create', 'TABLE_ON_subject_link', 'TABLE_ON_files',
    'TABLE_ON_links', 'TABLE_ON_code_register', 'TABLE_ON_staff', 'DOG_PHOTOS_FOLDER_ID', 'FILES_FOLDER_ID', 'USER_EDIT_ENABLED'].forEach((k) => assert.ok(by[k], k));
  assert.equal(by.TABLE_ON_files.on, true); assert.equal(by.TABLE_ON_links.on, false);
  assert.equal(by.DOG_PHOTOS_FOLDER_ID.set, true); assert.equal(by.FILES_FOLDER_ID.set, false);
  const text = JSON.stringify(st);
  ['FOLDER-PHOTOS', 'FOLDER-TEST', env.props.CODE_SALT, 'user@example.test', T].forEach((v) => assert.equal(text.indexOf(v), -1, 'leaked a value'));
  env.ctx.doGet({ parameter: {} });
  assert.ok(env.text('BLD-occupancy.csv').includes('occ-x'));
});

test('adminCountQueued: counts waiting rows per file and state, and writes nothing', () => {
  const env = fresh(['person', 'household', 'occupancy_out']);
  assert.equal(post(env, { table: 'person', action: 'add', code: env.codes.user, fields: { full_name: 'Invented One' } }).ok, true);
  assert.equal(post(env, { table: 'person', action: 'add', code: env.codes.user, fields: { full_name: 'Invented Two' } }).ok, true);
  assert.equal(post(env, { table: 'occupancy_out', action: 'add', code: env.codes.staff, fields: { subject_id: 'sub-test-a', off_site_kind: 'temporary' } }).ok, true);
  const s0 = sums(env), w0 = env.writes.length;
  const c = env.ctx.adminCountQueued();
  assert.deepEqual(changed(s0, sums(env)), []); assert.equal(env.writes.length, w0);
  assert.equal(c.total, 3);
  assert.equal(c.byFile['BLD-person.csv'], 2); assert.equal(c.byFile['BLD-occupancy.csv'], 1);
  assert.equal(c.byState.queued, 3);
  assert.equal(c.moves, 0);   // the occupancy_out row waits for the user: see R2
});

test('R2: a queued occupancy_out row is not applied by a plain GET', () => {
  const env = fresh(['occupancy', 'occupancy_out']);
  const r = post(env, { table: 'occupancy_out', action: 'add', code: env.codes.staff, fields: { subject_id: 'sub-test-a', off_site_kind: 'sold' } });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.result.status, 'queued');
  const before = env.text('BLD-occupancy.csv');
  assert.ok(!before.includes(r.result.id));
  env.ctx.doGet({ parameter: {} });
  assert.equal(env.text('BLD-occupancy.csv'), before, 'the out-move waits for the user');
  assert.ok(!env.text(PEND).includes('script:apply-direct-occupancy'));
});

test('the inventory document table matches the code', () => {
  const dir = path.join(__dirname, '..');
  const doc = fs.readdirSync(dir).filter((f) => /^AA_SAVE-INVENTORY_.*__CLAUDE-CODE\.md$/.test(f)).sort().pop();
  if (!doc) return;
  const text = fs.readFileSync(path.join(dir, doc), 'utf8');
  assert.equal(inventory.splice(text), text, 'run node tools/save-inventory.js --write ' + doc);
});

