'use strict';
// Dog card saves (draft, 12 Nov 2026): Add weight, Add vaccination, Remove the newest vaccination. Invented dogs only.
const { test } = require('node:test');
const assert = require('node:assert');
const { standardEnv } = require('./harness');

const WEIGHT_H = 'id,subject_id,performed_on,weight_kg,unit,body_condition_score,bcs_scale,source';
const VAX_H = 'id,tenant_id,subject_id,event_kind,product,product_shorthand,diseases_covered,batch,batch_use_by,given_on,route,administered_by,practice,titre_result,titre_lab,titre_protective,next_due_on_card,next_due_source,certificate_media_id,source,ruling_needed,note,voided_on,voided_by';
let n = 0;

function env(props, vaxRows, vaxHeader) {
  const e = standardEnv({ props: Object.assign({ TABLE_ON_weighing: 'true', TABLE_ON_vaccination: 'true' }, props || {}) });
  const subj = e.file('BLD-subject.csv');
  const text = 'id,tenant_id,name\r\nsub-test-a,' + e.props.TENANT_ID + ',Test A\r\nsub-test-b,' + e.props.TENANT_ID + ',Test B\r\n';
  if (subj.length) { subj[0].content = text; subj[0].sheet = undefined; } else e.addFile('BLD-subject.csv', text);
  e.addFile('BLD-weight.csv', WEIGHT_H + '\r\n');
  e.addFile('BLD-vaccination.csv', [vaxHeader || VAX_H].concat(vaxRows || []).join('\r\n') + '\r\n');
  return e;
}
function post(e, action, fields, code) {
  n += 1;
  const body = { v: 1, request_id: 'req-dogcard-' + String(n).padStart(4, '0'), code: code || e.codes.staff, action, fields };
  return JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}
const text = (e, name) => e.file(name)[0].content;

test('weighing: adds one row by header name; off until its switch is on; future dates and silly weights refused', () => {
  const off = env({ TABLE_ON_weighing: '' });
  assert.equal(post(off, 'weighing', { subject_id: 'sub-test-a', performed_on: '2026-01-02', weight_kg: '12.4' }).code, 'TABLE_OFF');
  const e = env();
  const r = post(e, 'weighing', { subject_id: 'sub-test-a', performed_on: '2026-01-02', weight_kg: '12.4', body_condition_score: '5' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const lines = text(e, 'BLD-weight.csv').trim().split(/\r?\n/);
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^wt[^,]*,sub-test-a,2026-01-02,12\.4,kg,5,9,"?CD Hub, Sam Staff"?$/);
  assert.equal(post(e, 'weighing', { subject_id: 'sub-test-a', performed_on: '2999-01-01', weight_kg: '12' }).code, 'INVALID');
  assert.equal(post(e, 'weighing', { subject_id: 'sub-test-a', performed_on: '2026-01-02', weight_kg: '999' }).code, 'INVALID');
  assert.equal(post(e, 'weighing', { subject_id: 'sub-nobody', performed_on: '2026-01-02', weight_kg: '10' }).code, 'NOT_FOUND');
  const saveOff = env({ SAVE_ENABLED: 'false' });
  assert.equal(post(saveOff, 'weighing', { subject_id: 'sub-test-a', performed_on: '2026-01-02', weight_kg: '10' }).code, 'SAVE_OFF');
});

test('vaccination: one row per vaccination, so a dog can have several; card link must be https', () => {
  const e = env();
  assert.equal(post(e, 'vaccination', { subject_id: 'sub-test-a', given_on: '2025-01-15', product: 'DHP', diseases_covered: 'distemper;adenovirus_ich;parvovirus', practice: 'Pretend Vets', certificate_link: 'https://example.test/card.jpg' }).ok, true);
  assert.equal(post(e, 'vaccination', { subject_id: 'sub-test-a', given_on: '2026-01-15', product: 'L4', diseases_covered: 'leptospirosis' }).ok, true);
  const rows = text(e, 'BLD-vaccination.csv').trim().split(/\r?\n/);
  assert.equal(rows.length, 3);
  assert.ok(rows[1].includes('distemper;adenovirus_ich;parvovirus') && rows[1].includes('https://example.test/card.jpg'));
  assert.equal(post(e, 'vaccination', { subject_id: 'sub-test-a', given_on: '2026-01-15', product: 'L4', certificate_link: 'http://x' }).code, 'INVALID');
  assert.equal(post(e, 'vaccination', { subject_id: 'sub-test-a', given_on: '2026-01-15', product: '=SUM(A1)' }).code, 'INVALID');
});

test('vaccination_void: only the newest row, marked removed (never deleted); then the one before becomes newest', () => {
  const T = 'ten-x';
  const e = env({}, [
    'vax-old,' + T + ',sub-test-a,vaccination,DHP,DHP,distemper,,,2024-01-01,,,,,,,,,,,,,,',
    'vax-new,' + T + ',sub-test-a,vaccination,L4,L4,leptospirosis,,,2025-01-01,,,,,,,,,,,,,,'
  ]);
  assert.equal(post(e, 'vaccination_void', { subject_id: 'sub-test-a', id: 'vax-old' }).code, 'NOT_ALLOWED');
  const r = post(e, 'vaccination_void', { subject_id: 'sub-test-a', id: 'vax-new' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const rows = text(e, 'BLD-vaccination.csv').trim().split(/\r?\n/);
  assert.equal(rows.length, 3);   // nothing deleted
  assert.match(rows[2], /^vax-new,.*,\d{4}-\d{2}-\d{2}T[^,]+,Sam Staff$/);
  assert.match(rows[1], /,,$/);   // the older row is untouched
  assert.equal(post(e, 'vaccination_void', { subject_id: 'sub-test-a', id: 'vax-old' }).ok, true);
});

test('vaccination_void refuses plainly when the sheet has no voided_on / voided_by columns', () => {
  const H = VAX_H.replace(',voided_on,voided_by', '');
  const e = env({}, ['vax-1,t,sub-test-a,vaccination,DHP,DHP,distemper,,,2024-01-01,,,,,,,,,,,,'], H);
  const r = post(e, 'vaccination_void', { subject_id: 'sub-test-a', id: 'vax-1' });
  assert.equal(r.code, 'HEADER_MISMATCH');
  assert.match(r.message, /voided_on, voided_by/);
});

test('dog_details: owner only, behind its own switch; changes the header fields in place and the chip row', () => {
  const e = env({ TABLE_ON_dog_details: 'true' });
  const subj = e.file('BLD-subject.csv')[0];
  subj.content = 'id,tenant_id,name,sex,dob,coat_colour_id,neuter_status\r\nsub-test-a,' + e.props.TENANT_ID + ',Test A,Female,2021-01-01,,entire\r\n';
  e.addFile('BLD-coat_colour.csv', 'id,name\r\ncol-choc,Pretend Chocolate\r\n');
  e.addFile('BLD-microchip.csv', 'id,tenant_id,subject_id,chip_number,source\r\n');
  assert.equal(post(e, 'dog_details', { subject_id: 'sub-test-a', name: 'Test A2' }).code, 'NOT_ALLOWED');   // staff code
  const r = post(e, 'dog_details', { subject_id: 'sub-test-a', name: 'Test A2', sex: 'Female', dob: '2021-02-03', coat_colour_id: 'col-choc', chip_number: '000 000 000 000 001' }, e.codes.owner);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.result.changed, ['name', 'dob', 'coat_colour_id', 'chip_number']);
  assert.match(text(e, 'BLD-subject.csv'), /sub-test-a,[^,]*,Test A2,Female,2021-02-03,col-choc,entire/);
  assert.match(text(e, 'BLD-microchip.csv'), /,sub-test-a,000000000000001,/);
  assert.equal(post(e, 'dog_details', { subject_id: 'sub-test-a', chip_number: '000000000000002' }, e.codes.owner).ok, true);
  assert.equal(text(e, 'BLD-microchip.csv').trim().split(/\r?\n/).length, 2);   // replaced, not a second row
  assert.equal(post(e, 'dog_details', { subject_id: 'sub-test-a', sex: 'X', coat_colour_id: 'col-none', chip_number: '12' }, e.codes.owner).code, 'INVALID');
  assert.equal(post(e, 'dog_details', { subject_id: 'sub-test-a', name: 'Test A2' }, e.codes.owner).code, 'NOTHING_CHANGED');
  const off = env();
  assert.equal(post(off, 'dog_details', { subject_id: 'sub-test-a', name: 'X' }, off.codes.owner).code, 'TABLE_OFF');
});
