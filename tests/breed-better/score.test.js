'use strict';
/** Breed Better calculator. All animals, tests and grades here are invented. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { score, pickScheme, validateScheme, parseMatch, addMonths } = require('../../breed-better/score');

const band = (id, kind) => ({ id, kind });
const crit = (id, band_id, extra) => Object.assign({ id, band_id, label: id, evidence_source: 'exam', evidence_match: 'kind=' + id, answer_field: 'result', date_field: 'on' }, extra);
const pt = (id, criterion_id, answer_match, points, gate_outcome) => ({ id, criterion_id, answer_match, points, gate_outcome });

/** One rule shape, three unlike species: only the rows differ. */
function ruleset(gateKey, passWord, scoreKey, topWord) {
  return {
    scheme: { id: 's' + gateKey },
    bands: [band('g', 'gate'), band('p', 'points')],
    criteria: [crit(gateKey, 'g', { valid_months: '12' }), crit(scoreKey, 'p')],
    points: [pt('1', gateKey, 'is:' + passWord, '', 'pass'), pt('2', gateKey, 'any', '', 'fail'),
      pt('3', scoreKey, 'is:' + topWord, 10), pt('4', scoreKey, 'any', 3)]
  };
}
const exam = (id, subject_id, kind, result, on) => ({ id, subject_id, kind, result, on });

const DOG = ruleset('hip', 'sound', 'eye', 'clear');
const dogInput = (rows, extra) => Object.assign({}, DOG, { subject: { id: 'a1', sex: 'female' }, evidence: { exam: rows }, asOf: '2026-06-01' }, extra);

test('three unlike species score with no code change, only different rows', () => {
  const cases = [
    [DOG, 'hip', 'sound', 'eye', 'clear'],
    [ruleset('heart', 'normal', 'coat', 'silky'), 'heart', 'normal', 'coat', 'silky'],
    [ruleset('feather', 'intact', 'egg', 'daily'), 'feather', 'intact', 'egg', 'daily']
  ];
  for (const [set, gk, gv, sk, sv] of cases) {
    const r = score(Object.assign({}, set, { subject: { id: 'a1' }, asOf: '2026-06-01',
      evidence: { exam: [exam('e1', 'a1', gk, gv, '2026-01-01'), exam('e2', 'a1', sk, sv, '2026-01-01')] } }));
    assert.equal(r.gate_result, 'pass');
    assert.equal(r.points_earned, 10);
    assert.equal(r.points_available, 10);
  }
});

test('verdict: any fail is Fail, even beside an unverified gate', () => {
  const set = Object.assign({}, DOG, { criteria: DOG.criteria.concat(crit('elbow', 'g')), points: DOG.points.concat(pt('5', 'elbow', 'is:ok', '', 'pass')) });
  const r = score(Object.assign({}, set, { subject: { id: 'a1' }, asOf: '2026-06-01', evidence: { exam: [exam('e1', 'a1', 'hip', 'poor', '2026-01-01')] } }));
  assert.equal(r.gate_result, 'fail');
});

test('verdict: missing evidence is Unverified, never Pass and never Fail', () => {
  const r = score(dogInput([]));
  assert.equal(r.gate_result, 'unverified');
  assert.equal(r.lines[0].unknown_reason, 'no_record');
  assert.equal(r.unknown_count, 2);
});

test('verdict: expired evidence is Unverified even when the answer was a pass', () => {
  const r = score(dogInput([exam('e1', 'a1', 'hip', 'sound', '2025-01-01')]));
  assert.equal(r.gate_result, 'unverified');
  assert.equal(r.lines[0].unknown_reason, 'expired');
});

test('evidence on its last valid day still counts; the day after it does not', () => {
  const rows = [exam('e1', 'a1', 'hip', 'sound', '2025-06-01')];
  assert.equal(score(dogInput(rows, { asOf: '2026-06-01' })).gate_result, 'pass');
  assert.equal(score(dogInput(rows, { asOf: '2026-06-02' })).gate_result, 'unverified');
});

test('an undated record cannot satisfy a gate that expires', () => {
  const r = score(dogInput([exam('e1', 'a1', 'hip', 'sound', '')]));
  assert.equal(r.gate_result, 'unverified');
  assert.equal(r.lines[0].unknown_reason, 'undated');
});

test('an answer with no matching rule is flagged, not scored zero', () => {
  const set = Object.assign({}, DOG, { points: [pt('1', 'hip', 'is:sound', '', 'pass'), pt('3', 'eye', 'is:clear', 10)] });
  const r = score(Object.assign({}, set, { subject: { id: 'a1' }, asOf: '2026-06-01', evidence: { exam: [exam('e1', 'a1', 'hip', 'odd', '2026-01-01'), exam('e2', 'a1', 'eye', 'odd', '2026-01-01')] } }));
  assert.equal(r.gate_result, 'unverified');
  assert.equal(r.points_unverified, 10);
  assert.equal(r.lines[1].unknown_reason, 'no_rule_for_answer');
});

test('the score is built only from rows: every point traces to its record', () => {
  const r = score(dogInput([exam('e1', 'a1', 'hip', 'sound', '2026-01-01'), exam('e2', 'a1', 'eye', 'hazy', '2026-02-01')]));
  assert.equal(r.points_earned, 3);
  assert.equal(r.points_available, 10);
  assert.deepEqual(r.lines.map((l) => l.evidence_id), ['e1', 'e2']);
  assert.equal(r.lines[1].answer_then, 'hazy');
});

test('latest record wins; a later record dated after the score date is ignored', () => {
  const rows = [exam('e1', 'a1', 'eye', 'hazy', '2024-01-01'), exam('e2', 'a1', 'eye', 'clear', '2025-01-01'), exam('e3', 'a1', 'eye', 'hazy', '2027-01-01')];
  assert.equal(score(dogInput(rows)).points_earned, 10);
});

test('another animal\'s records are never used', () => {
  assert.equal(score(dogInput([exam('e1', 'b2', 'hip', 'sound', '2026-01-01')])).gate_result, 'unverified');
});

test('lowest reads the worst of several rows', () => {
  const set = { scheme: { id: 's' }, bands: [band('p', 'points')],
    criteria: [crit('panel', 'p', { evidence_match: '', reads: 'lowest', answer_field: 'result' })],
    points: [pt('1', 'panel', 'is:clear', 5), pt('2', 'panel', 'is:carrier', 2), pt('3', 'panel', 'any', 0)] };
  const r = score(Object.assign({}, set, { subject: { id: 'a1' }, asOf: '2026-06-01', evidence: { exam: [exam('e1', 'a1', 'x', 'clear', '2026-01-01'), exam('e2', 'a1', 'y', 'carrier', '2026-01-01')] } }));
  assert.equal(r.points_earned, 2);
  assert.equal(r.lines[0].evidence_id, 'e2');
});

test('count reads how many rows, and none is a real answer of 0', () => {
  const set = { scheme: { id: 's' }, bands: [band('g', 'gate')],
    criteria: [crit('births', 'g', { evidence_match: '', reads: 'count', subject_field: 'mother', date_field: 'on' })],
    points: [pt('1', 'births', 'range:0-2', '', 'pass'), pt('2', 'births', 'any', '', 'fail')] };
  const run = (rows) => score(Object.assign({}, set, { subject: { id: 'a1' }, asOf: '2026-06-01', evidence: { exam: rows } })).gate_result;
  const birth = (id) => ({ id, mother: 'a1', on: '2025-01-01' });
  assert.equal(run([]), 'pass');
  assert.equal(run([birth('1'), birth('2'), birth('3')]), 'fail');
});

test('a rule that applies to one sex is skipped for the other and not counted as available', () => {
  const set = Object.assign({}, DOG, { criteria: [crit('eye', 'p', { applies_to: 'sex=female' })], points: [pt('3', 'eye', 'is:clear', 10)] });
  const r = score(Object.assign({}, set, { subject: { id: 'm1', sex: 'male' }, asOf: '2026-06-01', evidence: { exam: [] } }));
  assert.equal(r.points_available, 0);
  assert.equal(r.lines.length, 0);
});

test('a judged item records who judged it, and is unverified until judged', () => {
  const set = { scheme: { id: 's' }, bands: [band('p', 'points')], criteria: [{ id: 'j', band_id: 'p', label: 'j', evidence_source: 'judged' }], points: [pt('1', 'j', 'is:yes', 5), pt('2', 'j', 'any', 0)] };
  const base = Object.assign({}, set, { subject: { id: 'a1' }, asOf: '2026-06-01' });
  assert.equal(score(base).points_unverified, 5);
  const r = score(Object.assign({}, base, { judgements: { j: { answer: 'yes', by: 'person_1' } } }));
  assert.equal(r.points_earned, 5);
  assert.equal(r.lines[0].judged_by, 'person_1');
});

test('a status row shows but earns nothing', () => {
  const set = { scheme: { id: 's' }, bands: [band('b', 'status')], criteria: [crit('st', 'b', { evidence_match: '', answer_field: 'result' })], points: [] };
  const r = score(Object.assign({}, set, { subject: { id: 'a1' }, asOf: '2026-06-01', evidence: { exam: [exam('e1', 'a1', 'st', 'active', '2026-01-01')] } }));
  assert.equal(r.lines[0].answer_then, 'active');
  assert.equal(r.points_available, 0);
  assert.equal(r.gate_result, 'pass');
});

test('rule changes: an old date keeps the old version, a new date gets the new one', () => {
  const s = (id, version, effective_from, status, breed) => ({ id, version, effective_from, status: status || 'active', species_id: 'sp1', breed: breed || '' });
  const list = [s('v1', 1, '2025-01-01', 'active', 'B'), s('v2', 2, '2026-01-01', 'active', 'B'), s('w', 1, '2024-01-01'), s('d', 3, '2025-06-01', 'draft', 'B')];
  assert.equal(pickScheme(list, 'sp1', 'B', '2025-06-01').id, 'v1');
  assert.equal(pickScheme(list, 'sp1', 'B', '2026-06-01').id, 'v2');
  assert.equal(pickScheme(list, 'sp1', 'Other', '2026-06-01').id, 'w');
  assert.equal(pickScheme(list, 'sp2', 'B', '2026-06-01'), null);
  assert.equal(pickScheme(list, 'sp1', 'B', '2020-01-01'), null);
});

test('rules that could fake a pass or run anything are refused', () => {
  const bad = (over) => validateScheme(Object.assign({}, DOG, over));
  assert.deepEqual(validateScheme(DOG), []);
  assert.ok(bad({ criteria: [crit('hip', 'g', { when_missing: 'pass' })] }).some((e) => /when_missing/.test(e)));
  assert.ok(bad({ points: [pt('1', 'hip', 'eval(1)', '', 'pass'), pt('2', 'eye', 'any', 1)] }).some((e) => /not understood/.test(e)));
  assert.ok(bad({ points: [pt('1', 'hip', 'any', 5), pt('2', 'eye', 'any', 1)] }).some((e) => /gate answer/.test(e)));
  assert.throws(() => score(Object.assign({}, DOG, { criteria: [crit('hip', 'g', { when_missing: 'pass' })], subject: { id: 'a' }, asOf: '2026-01-01' })), /problems/);
});

test('small helpers', () => {
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2025-12-15', 2), '2026-02-15');
  assert.equal(parseMatch('nonsense'), null);
  assert.throws(() => score(Object.assign({}, DOG, { subject: { id: 'a' }, asOf: 'today' })), /asOf/);
});

test('a count ignores rows with no date', () => {
  const set = { scheme: { id: 's' }, bands: [{ id: 'b', kind: 'gate' }],
    criteria: [{ id: 'c', band_id: 'b', evidence_source: 'births', subject_field: 'mother', date_field: 'on', reads: 'count' }],
    points: [{ id: 'p', criterion_id: 'c', answer_match: 'range:0-1', gate_outcome: 'pass' }, { id: 'q', criterion_id: 'c', answer_match: 'any', gate_outcome: 'fail' }] };
  const births = [{ id: '1', mother: 'a', on: '2025-01-01' }, { id: '2', mother: 'a', on: '' }, { id: '3', mother: 'a', on: '' }];
  assert.equal(score(Object.assign({}, set, { subject: { id: 'a' }, asOf: '2026-01-01', evidence: { births } })).gate_result, 'pass');
});

test('a recorded answer that cannot be scored is unverified, never 0', () => {
  const set = { scheme: { id: 's' }, bands: [{ id: 'b', kind: 'points' }],
    criteria: [{ id: 'c', band_id: 'b', evidence_source: 'exam', answer_field: 'r', date_field: 'on' }],
    points: [{ id: 'p', criterion_id: 'c', answer_match: 'is:NOT RECORDED', gate_outcome: 'unverified' }, { id: 'q', criterion_id: 'c', answer_match: 'is:good', points: '5' }, { id: 'z', criterion_id: 'c', answer_match: 'any', points: '0' }] };
  const r = score(Object.assign({}, set, { subject: { id: 'a' }, asOf: '2026-01-01', evidence: { exam: [{ id: 'e', subject_id: 'a', r: 'NOT RECORDED', on: '2025-01-01' }] } }));
  assert.equal(r.points_earned, 0);
  assert.equal(r.points_unverified, 5);
  assert.equal(r.lines[0].unknown_reason, 'recorded_unverified');
});

