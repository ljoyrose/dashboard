'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { standardEnv } = require('./harness');

const A_H = 'id,tenant_id,subject_id,scheme_id,period,verdict,points_earned,points_available,points_unverified,unknown_count,status,calculated_at,calculated_by,replaces_id';
const L_H = 'id,tenant_id,assessment_id,criterion_id,label_then,evidence_table,evidence_record_id,answer_then,points,points_max,gate_outcome,unknown_reason,judged_at,judged_by,rule_version_then';
let n = 0;

function env(props, heads) {
  const e = standardEnv({ props: Object.assign({ TABLE_ON_score_assessment: 'true' }, props || {}) });
  const t = e.props.TENANT_ID;
  const subj = 'id,tenant_id,name\r\nsub-test-a,' + t + ',Test A\r\n';
  const f = e.file('BLD-subject.csv');
  if (f.length) { f[0].content = subj; f[0].sheet = undefined; } else e.addFile('BLD-subject.csv', subj);
  e.addFile('BLD-score_scheme.csv', 'id,tenant_id,name\r\nsch-test,' + t + ',Test scheme\r\n');
  e.addFile('BLD-score_assessment.csv', ((heads && heads.a) || A_H) + '\r\n');
  e.addFile('BLD-score_line.csv', ((heads && heads.l) || L_H) + '\r\n');
  return e;
}
function post(e, fields, code) {
  n += 1;
  const body = { v: 1, request_id: 'req-score-' + String(n).padStart(4, '0'), code: code || e.codes.user, action: 'score_save', fields };
  return JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}
const rows = (e, f) => e.file(f)[0].content.trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
const LINES = [
  { criterion_id: 'c-hip', label_then: 'Hips', evidence_table: 'health_screen', evidence_record_id: 'hs-1', answer_then: 'Good', gate_outcome: 'pass' },
  { criterion_id: 'c-eye', label_then: 'Eyes', points: '', points_max: '10', unknown_reason: 'no_record' }
];
const S = (extra) => Object.assign({ subject_id: 'sub-test-a', scheme_id: 'sch-test', period: '2026-10-15', verdict: 'unverified',
  points_earned: '15', points_available: '25', points_unverified: '10', unknown_count: '1', lines: LINES }, extra);

test('score_save: OFF behind its own switch; user only', () => {
  const off = env({ TABLE_ON_score_assessment: '' });
  assert.equal(post(off, S()).code, 'TABLE_OFF');
  const e = env();
  assert.equal(post(e, S(), e.codes.staff).code, 'NOT_ALLOWED');
  assert.equal(rows(e, 'BLD-score_assessment.csv').length, 0);
});

test('score_save: one assessment and its lines; saving again adds a new one that replaces the old, nothing edited', () => {
  const e = env();
  const r1 = post(e, S());
  assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.equal(r1.result.lines, 2);
  const a = rows(e, 'BLD-score_assessment.csv'), l = rows(e, 'BLD-score_line.csv');
  assert.equal(a.length, 1);
  assert.deepEqual([a[0][2], a[0][3], a[0][4], a[0][5], a[0][6], a[0][7], a[0][10], a[0][13]], ['sub-test-a', 'sch-test', '2026-10-15', 'unverified', '15', '25', 'saved', '']);
  assert.equal(l.length, 2);
  assert.ok(l.every((x) => x[2] === r1.result.id));
  assert.deepEqual([l[0][3], l[0][7], l[0][10]], ['c-hip', 'Good', 'pass']);
  assert.deepEqual([l[1][3], l[1][9], l[1][11]], ['c-eye', '10', 'no_record']);
  const r2 = post(e, S({ verdict: 'pass', points_earned: '25', points_unverified: '0', unknown_count: '0' }));
  assert.equal(r2.result.replaces_id, r1.result.id);
  const a2 = rows(e, 'BLD-score_assessment.csv');
  assert.equal(a2.length, 2);
  assert.deepEqual(a2[0], a[0]);   // the first is untouched
  assert.equal(rows(e, 'BLD-score_line.csv').length, 4);
});

test('score_save: refuses bad input, unknown records, future dates and a missing column, saving nothing', () => {
  const e = env();
  const bad = post(e, S({ verdict: 'great', lines: [{ criterion_id: '', gate_outcome: 'maybe' }] }));
  assert.equal(bad.code, 'INVALID');
  assert.ok(bad.fields.verdict && bad.fields['lines.0.criterion_id'] && bad.fields['lines.0.gate_outcome']);
  assert.equal(post(e, S({ lines: [] })).code, 'INVALID');
  assert.equal(post(e, S({ period: '2099-01-01' })).code, 'INVALID');
  assert.equal(post(e, S({ subject_id: 'sub-nobody' })).code, 'NOT_FOUND');
  assert.equal(rows(e, 'BLD-score_assessment.csv').length, 0);
  assert.equal(rows(e, 'BLD-score_line.csv').length, 0);
  const short = env({}, { a: A_H.replace(',replaces_id', '') });
  assert.equal(post(short, S()).code, 'HEADER_MISMATCH');
});

