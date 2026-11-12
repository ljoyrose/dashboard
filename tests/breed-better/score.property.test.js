'use strict';
/**
 * Breed Better calculator: property tests on generated rows (JOB BB-FIN.1, 12 Nov 2026).
 * Every animal, test, grade and date here is invented by a seeded generator: same seed, same rows, every run.
 * No new dependency. Each property runs RUNS times; a failure names its seed so it can be replayed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Score = require('../../breed-better/score');
const View = require('../../breed-better/hub-view');
const { score, validateScheme, addMonths, targetFor } = Score;

const RUNS = 150;

/** mulberry32: a tiny seeded random number source. */
function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = (xs) => xs[int(0, xs.length - 1)];
  const date = (from, to) => { // YYYY-MM-DD between two years, any real day
    const y = int(from, to), m = int(1, 12), last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return y + '-' + String(m).padStart(2, '0') + '-' + String(int(1, last)).padStart(2, '0');
  };
  return { next, int, pick, date, bool: () => next() < 0.5 };
}

function forAll(name, fn) {
  test(name, () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      try { fn(rng(seed * 7919 + name.length), seed); } catch (e) { e.message = '[seed ' + seed + '] ' + e.message; throw e; }
    }
  });
}

const AS_OF = '2026-06-01';
const exam = (id, kind, result, on, subject_id = 'a1') => ({ id, subject_id, kind, result, on });

/**
 * A random scheme: 1-3 gates (ok = pass, bad = fail, nr = unverified) and 1-4 points lines (top, mid, low).
 * Returns the rows plus a helper to make a record for any line.
 */
function makeScheme(r, opts = {}) {
  const gates = [], lines = [], points = [];
  const nG = opts.gates ?? r.int(1, 3), nP = opts.lines ?? r.int(1, 4);
  for (let i = 0; i < nG; i++) {
    const id = 'g' + i;
    gates.push({ id, band_id: 'G', label: id, evidence_source: 'exam', evidence_match: 'kind=' + id, answer_field: 'result', date_field: 'on',
      when_missing: opts.gateMissing ?? r.pick(['unknown', 'zero', 'fail', '']) });
    points.push({ id: id + 'p', criterion_id: id, answer_match: 'is:ok', gate_outcome: 'pass' },
      { id: id + 'f', criterion_id: id, answer_match: 'is:bad', gate_outcome: 'fail' },
      { id: id + 'u', criterion_id: id, answer_match: 'is:nr', gate_outcome: 'unverified' });
  }
  for (let i = 0; i < nP; i++) {
    const id = 'p' + i, top = r.int(2, 10), mid = r.int(1, top - 1);
    lines.push({ id, band_id: 'P', label: id, evidence_source: 'exam', evidence_match: 'kind=' + id, answer_field: 'result', date_field: 'on',
      when_missing: opts.lineMissing ?? r.pick(['unknown', 'zero', '']) });
    points.push({ id: id + 't', criterion_id: id, answer_match: 'is:top', points: String(top) },
      { id: id + 'm', criterion_id: id, answer_match: 'is:mid', points: String(mid) },
      { id: id + 'l', criterion_id: id, answer_match: 'is:low', points: '0' });
  }
  return {
    scheme: { id: 's1', target_points: opts.target ?? '', target_is: opts.targetIs ?? '' },
    bands: [{ id: 'G', kind: 'gate' }, { id: 'P', kind: 'points' }],
    criteria: gates.concat(lines), points, gates, lines
  };
}
const recent = (r) => r.date(2024, 2025);
const run = (set, rows, extra = {}) => score(Object.assign({}, set, { subject: { id: 'a1', sex: 'female', dob: '2020-01-01' }, evidence: { exam: rows }, asOf: AS_OF }, extra));

/* 1. Missing evidence never passes */
forAll('property: a gate with no record (and no skip) is never a Pass', (r) => {
  const set = makeScheme(r);
  const missing = r.int(0, set.gates.length - 1);
  const rows = [];
  set.gates.forEach((g, i) => { if (i !== missing) rows.push(exam('e' + i, g.id, r.pick(['ok', 'ok', 'nr']), recent(r))); });
  set.lines.forEach((l, i) => rows.push(exam('l' + i, l.id, r.pick(['top', 'mid', 'low']), recent(r))));
  const out = run(set, rows);
  assert.notEqual(out.gate_result, 'pass');
  assert.notEqual(out.verdict, 'pass');
  const line = out.lines.find((x) => x.criterion_id === 'g' + missing);
  assert.equal(line.unknown_reason, 'no_record');
});

/* 2. Any fail is Fail */
forAll('property: one failed gate makes the verdict Fail, whatever else is true', (r) => {
  const set = makeScheme(r, { target: String(r.int(0, 30)), targetIs: r.pick(['points', 'percent', '']) });
  const failing = r.int(0, set.gates.length - 1);
  const rows = [];
  set.gates.forEach((g, i) => {
    if (i === failing) rows.push(exam('e' + i, g.id, 'bad', recent(r)));
    else if (r.bool()) rows.push(exam('e' + i, g.id, r.pick(['ok', 'nr', 'weird', '']), r.date(2015, 2026)));
  });
  set.lines.forEach((l, i) => { if (r.bool()) rows.push(exam('l' + i, l.id, r.pick(['top', 'mid', 'low', 'weird']), recent(r))); });
  const out = run(set, rows);
  assert.equal(out.gate_result, 'fail');
  assert.equal(out.verdict, 'fail');
});

/* 3. An answer that matches no rule is flagged, never scored 0 and never a Fail */
forAll('property: an answer no rule matches is flagged and held as unverified, never 0 and never Fail', (r) => {
  const set = makeScheme(r, { gateMissing: r.pick(['unknown', 'zero', 'fail']), lineMissing: r.pick(['unknown', 'zero', 'fail']) });
  const odd = 'odd-' + r.int(1, 999);
  const rows = set.gates.map((g, i) => exam('e' + i, g.id, i === 0 ? odd : 'ok', recent(r)))
    .concat(set.lines.map((l, i) => exam('l' + i, l.id, i === 0 ? odd : 'top', recent(r))));
  const out = run(set, rows);
  const g = out.lines.find((x) => x.criterion_id === 'g0'), p = out.lines.find((x) => x.criterion_id === 'p0');
  assert.equal(g.unknown_reason, 'no_rule_for_answer');
  assert.equal(g.gate_outcome, 'unverified');
  assert.equal(p.unknown_reason, 'no_rule_for_answer');
  assert.equal(p.points, '', 'an unmatched answer must not be scored 0');
  assert.ok(out.points_unverified >= p.points_max);
  assert.notEqual(out.verdict, 'fail');
});

/* 4. Overlapping dated versions of one check are refused; neat hand-overs are allowed */
forAll('property: two versions of one check whose dates overlap are refused; a clean hand-over is accepted', (r) => {
  const set = makeScheme(r, { gates: 1, lines: 1 });
  const a = r.date(2020, 2026), b = r.date(2020, 2026);
  const [from1, to1] = a <= b ? [a, b] : [b, a];
  const from2 = r.bool() ? r.date(2020, 2027) : '';
  const to2 = from2 && r.bool() ? addMonths(from2, r.int(0, 24)) : '';
  const v1 = Object.assign({}, set.lines[0], { key: 'k', from_date: r.bool() ? from1 : '', to_date: to1 });
  const v2 = Object.assign({}, set.lines[0], { id: 'p0b', key: 'k', from_date: from2, to_date: to2 });
  const pts = set.points.concat(set.points.filter((p) => p.criterion_id === 'p0').map((p) => Object.assign({}, p, { id: p.id + 'b', criterion_id: 'p0b' })));
  const rules = Object.assign({}, set, { criteria: set.gates.concat([v1, v2]), points: pts });
  const lo = (x) => x.from_date || '0000-00-00', hi = (x) => x.to_date || '9999-12-31';
  const overlap = lo(v1) <= hi(v2) && lo(v2) <= hi(v1);
  const found = validateScheme(rules).some((e) => /overlap/.test(e));
  assert.equal(found, overlap, JSON.stringify([v1.from_date, v1.to_date, v2.from_date, v2.to_date]));
  if (overlap) assert.throws(() => run(rules, []), /overlap/);
});

/* 5. A rule change never turns an old record into a Fail */
forAll('property: a stricter rule from a later date never fails a record made under the old rule', (r) => {
  const change = r.date(2022, 2025);
  const old = { id: 'h1', key: 'hip', band_id: 'G', label: 'Hips', evidence_source: 'exam', evidence_match: 'kind=hip', answer_field: 'result', date_field: 'on', to_date: change };
  const now = Object.assign({}, old, { id: 'h2', from_date: nextDay(change), to_date: '' });
  const set = {
    scheme: { id: 's1' }, bands: [{ id: 'G', kind: 'gate' }], criteria: [old, now],
    points: [{ id: 'a', criterion_id: 'h1', answer_match: 'in:A|B|C', gate_outcome: 'pass' }, { id: 'b', criterion_id: 'h1', answer_match: 'any', gate_outcome: 'fail' },
      { id: 'c', criterion_id: 'h2', answer_match: 'in:A|B', gate_outcome: 'pass' }, { id: 'd', criterion_id: 'h2', answer_match: 'any', gate_outcome: 'fail' }]
  };
  const recDate = r.date(2015, Number(change.slice(0, 4)) - 1);
  const asOf = r.date(Number(change.slice(0, 4)) + 1, 2027);
  const out = score(Object.assign({}, set, { subject: { id: 'a1' }, evidence: { exam: [exam('x', 'hip', 'C', recDate)] }, asOf }));
  assert.equal(out.lines[0].gate_outcome, 'pass');
  assert.equal(out.lines[0].rules_then, true);
  assert.equal(out.lines[0].criterion_id, 'h1');
  // the same answer recorded after the change is graded by the new rule
  const after = score(Object.assign({}, set, { subject: { id: 'a1' }, evidence: { exam: [exam('y', 'hip', 'C', asOf)] }, asOf }));
  assert.equal(after.lines[0].gate_outcome, 'fail');
});
function nextDay(d) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); }

/* 6. A target in points and the same target as a percent give the same verdict, at and around the boundary */
forAll('property: target as points and as the matching percent give the same verdict at the boundary', (r) => {
  const set = makeScheme(r, { gates: 1, lines: r.int(1, 4) });
  const available = set.lines.reduce((s, l) => s + Math.max(...set.points.filter((p) => p.criterion_id === l.id).map((p) => Number(p.points))), 0);
  const percents = [];
  for (let p = 1; p <= 100; p++) percents.push(p);
  const pct = r.pick(percents);
  const need = targetFor({ target_points: String(pct), target_is: 'percent' }, available);
  assert.equal(need, Math.ceil(available * pct / 100));
  const rows = [exam('g', 'g0', 'ok', recent(r))].concat(set.lines.map((l, i) => exam('l' + i, l.id, r.pick(['top', 'mid', 'low']), recent(r))));
  const asPoints = run(Object.assign({}, set, { scheme: { id: 's1', target_points: String(need), target_is: 'points' } }), rows);
  const asPercent = run(Object.assign({}, set, { scheme: { id: 's1', target_points: String(pct), target_is: 'percent' } }), rows);
  assert.equal(asPoints.target, asPercent.target);
  assert.equal(asPoints.verdict, asPercent.verdict);
  assert.equal(asPoints.verdict, asPoints.points_earned >= need ? 'pass' : 'below_target');
});

forAll('property: earned exactly on the target passes; one short does not', (r) => {
  const set = makeScheme(r, { gates: 1, lines: 1 });
  const top = Number(set.points.find((p) => p.id === 'p0t').points), mid = Number(set.points.find((p) => p.id === 'p0m').points);
  const rows = [exam('g', 'g0', 'ok', recent(r)), exam('l', 'p0', 'mid', recent(r))];
  const at = run(Object.assign({}, set, { scheme: { id: 's1', target_points: String(mid) } }), rows);
  const over = run(Object.assign({}, set, { scheme: { id: 's1', target_points: String(mid + 1) } }), rows);
  assert.equal(at.verdict, 'pass');
  assert.equal(over.verdict, 'below_target');
  assert.ok(top > 0);
  const pctAt = Math.floor(mid * 100 / top);
  assert.equal(run(Object.assign({}, set, { scheme: { id: 's1', target_points: String(pctAt), target_is: 'percent' } }), rows).verdict, 'pass');
});

/* points with tenths must not drift: 0.1 + 0.2 is not 0.30000000000000004 on screen or against a target */
forAll('property: points with tenths add up exactly, so a target equal to the sum passes', (r) => {
  const n = r.int(2, 5), crits = [], pts = [], rows = [];
  let tenths = 0;
  for (let i = 0; i < n; i++) {
    const t = r.int(1, 39); tenths += t;
    crits.push({ id: 'p' + i, band_id: 'P', evidence_source: 'exam', evidence_match: 'kind=p' + i, answer_field: 'result', date_field: 'on' });
    pts.push({ id: 'x' + i, criterion_id: 'p' + i, answer_match: 'any', points: (t / 10).toFixed(1) });
    rows.push(exam('r' + i, 'p' + i, 'yes', recent(r)));
  }
  const exact = tenths / 10;
  const set = { scheme: { id: 's1', target_points: exact.toFixed(1) }, bands: [{ id: 'P', kind: 'points' }], criteria: crits, points: pts };
  const out = run(set, rows);
  assert.equal(out.points_earned, exact);
  assert.equal(out.points_available, exact);
  assert.equal(out.verdict, 'pass');
  const pct = run(Object.assign({}, set, { scheme: { id: 's1', target_points: '100', target_is: 'percent' } }), rows);
  assert.equal(pct.verdict, 'pass', 'a 100% target is reachable when every line is at its best');
});

/* 7. Maidens skip litter lines */
forAll('property: a line set to skip leaves the total when there is no record, and changes nothing else', (r) => {
  const set = makeScheme(r, { lines: r.int(1, 3), target: String(r.int(0, 15)) });
  const litter = { id: 'lit', band_id: 'P', label: 'Last litter', evidence_source: 'exam', evidence_match: 'kind=lit', answer_field: 'result', date_field: 'on', when_missing: 'skip', applies_to: 'sex=female' };
  const withLitter = Object.assign({}, set, { criteria: set.criteria.concat(litter), points: set.points.concat({ id: 'lt', criterion_id: 'lit', answer_match: 'any', points: '5' }) });
  const rows = set.gates.map((g, i) => exam('e' + i, g.id, r.pick(['ok', 'nr', 'bad']), recent(r)))
    .concat(set.lines.map((l, i) => exam('l' + i, l.id, r.pick(['top', 'mid', 'low']), recent(r))));
  const a = run(set, rows), b = run(withLitter, rows);
  assert.equal(b.lines.some((x) => x.criterion_id === 'lit'), false);
  for (const k of ['verdict', 'gate_result', 'points_earned', 'points_available', 'points_unverified', 'unknown_count']) assert.deepEqual(b[k], a[k], k);
  // a male is not asked at all, record or not
  const male = run(withLitter, rows.concat(exam('lx', 'lit', 'yes', recent(r))), { subject: { id: 'a1', sex: 'male' } });
  assert.equal(male.lines.some((x) => x.criterion_id === 'lit'), false);
});

/* 8. age_weight boundaries */
forAll('property: age_weight 0-11:0.5 halves a record made up to 11 whole months old, and not from 12 months', (r) => {
  const dob = r.date(2018, 2022);
  const set = { scheme: { id: 's1' }, bands: [{ id: 'P', kind: 'points' }],
    criteria: [{ id: 'x', band_id: 'P', evidence_source: 'exam', evidence_match: 'kind=x', answer_field: 'result', date_field: 'on', age_weight: '0-11:0.5' }],
    points: [{ id: 'xp', criterion_id: 'x', answer_match: 'any', points: String(2 * r.int(1, 10)) }] };
  const full = Number(set.points[0].points);
  const one = (on) => score(Object.assign({}, set, { subject: { id: 'a1', dob }, evidence: { exam: [exam('r', 'x', 'yes', on)] }, asOf: AS_OF })).lines[0];
  const at12 = addMonths(dob, 12);
  const dayBefore = prevDay(at12);
  const early = one(addMonths(dob, r.int(0, 11)));
  assert.equal(early.points, full / 2);
  const d11 = one(dayBefore);
  assert.equal(d11.age_months, 11, dob + ' -> ' + dayBefore);
  assert.equal(d11.points, full / 2);
  const d12 = one(at12);
  // 12 whole months, except when the birthday is 29-31 and the month is shorter (then the day has not come round yet)
  if (Number(dob.slice(8)) <= 28) { assert.equal(d12.age_months, 12); assert.equal(d12.points, full); }
  assert.equal(one(addMonths(dob, 13 + r.int(0, 30))).points, full);
});
function prevDay(d) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); }

/* 9. lapsed_affects_verdict FALSE never changes the verdict */
forAll('property: with lapsed_affects_verdict FALSE an out-of-date record scores as if it were in date', (r) => {
  const set = makeScheme(r, { target: String(r.int(0, 20)) });
  const months = r.int(6, 36);
  set.criteria.forEach((c) => { c.valid_months = String(months); c.lapsed_affects_verdict = 'FALSE'; c.due_soon_days = r.bool() ? String(r.int(1, 90)) : ''; });
  const answers = set.criteria.map((c) => (c.band_id === 'G' ? r.pick(['ok', 'bad', 'nr']) : r.pick(['top', 'mid', 'low'])));
  const fresh = set.criteria.map((c, i) => exam('f' + i, c.id, answers[i], prevDay(AS_OF)));
  const stale = set.criteria.map((c, i) => exam('s' + i, c.id, answers[i], addMonths(AS_OF, -(months + r.int(1, 48)))));
  const a = run(set, fresh), b = run(set, stale);
  for (const k of ['verdict', 'gate_result', 'points_earned', 'points_available', 'points_unverified']) assert.deepEqual(b[k], a[k], k);
  assert.ok(b.lines.every((l) => l.due === 'overdue'));
  // and with the column TRUE or blank, the same stale records are held as Unverified
  set.criteria.forEach((c) => { c.lapsed_affects_verdict = r.pick(['TRUE', '']); });
  const c = run(set, stale);
  assert.ok(c.lines.every((l) => l.unknown_reason === 'expired'));
  assert.notEqual(c.verdict, 'pass');
});

/* no peeking: a record dated after the scoring date never changes the result */
forAll('property: records dated after the scoring date are ignored', (r) => {
  const set = makeScheme(r);
  const rows = set.criteria.map((c, i) => exam('n' + i, c.id, c.band_id === 'G' ? r.pick(['ok', 'nr']) : r.pick(['top', 'mid']), recent(r)));
  const future = set.criteria.map((c, i) => exam('z' + i, c.id, c.band_id === 'G' ? 'bad' : 'low', r.date(2027, 2030)));
  const a = run(set, rows), b = run(set, rows.concat(future));
  assert.deepEqual(b.verdict, a.verdict);
  assert.deepEqual(b.points_earned, a.points_earned);
});

/* 10. verdict_words renames labels only */
forAll('property: verdict_words changes the words on screen, never the verdict, points or order', (r) => {
  const n = r.int(2, 5), subjects = [], enrol = [], exams = [];
  for (let i = 0; i < n; i++) {
    subjects.push({ id: 'a' + i, name: 'Test' + String.fromCharCode(65 + i) });
    enrol.push({ id: 'e' + i, scheme_id: 's1', subject_id: 'a' + i });
    if (r.bool()) exams.push({ id: 'x' + i, subject_id: 'a' + i, kind: 'c', r: r.pick(['ok', 'bad', 'nr']), on: recent(r) });
    if (r.bool()) exams.push({ id: 'y' + i, subject_id: 'a' + i, kind: 'd', r: r.pick(['hi', 'lo']), on: recent(r) });
  }
  const words = r.pick(['', 'pass=Good to go', 'unverified=To prove;fail=Not this time', 'below_target=Nearly;pass=Yes', 'nonsense=Zzz', 'pass=']);
  const T = (w) => ({
    'BLD-score_scheme.csv': [{ id: 's1', status: 'active', effective_from: '2026-01-01', target_points: '5', verdict_words: w }],
    'BLD-score_band.csv': [{ id: 'g', scheme_id: 's1', kind: 'gate', label: 'Gates' }, { id: 'p', scheme_id: 's1', kind: 'points', label: 'Points' }],
    'BLD-score_criterion.csv': [{ id: 'c', scheme_id: 's1', band_id: 'g', evidence_source: 'BLD-exam', evidence_match: 'kind=c', answer_field: 'r', date_field: 'on' },
      { id: 'd', scheme_id: 's1', band_id: 'p', evidence_source: 'BLD-exam', evidence_match: 'kind=d', answer_field: 'r', date_field: 'on' }],
    'BLD-score_point.csv': [{ id: 'p1', criterion_id: 'c', answer_match: 'is:ok', gate_outcome: 'pass' }, { id: 'p2', criterion_id: 'c', answer_match: 'is:bad', gate_outcome: 'fail' },
      { id: 'p3', criterion_id: 'c', answer_match: 'is:nr', gate_outcome: 'unverified' }, { id: 'p4', criterion_id: 'd', answer_match: 'is:hi', points: '8' }, { id: 'p5', criterion_id: 'd', answer_match: 'is:lo', points: '2' }],
    'BLD-score_enrolment.csv': enrol, 'BLD-subject.csv': subjects, 'BLD-exam.csv': exams
  });
  // two different days so the view's memo cannot hand back the first answer
  const plain = View.compute({ T: T(''), today: '2026-06-01' });
  const named = View.compute({ T: T(words), today: '2026-06-02' });
  const strip = (c) => c.results.map((x) => [x.subject_id, x.verdict, x.gate_result, x.points_earned, x.points_available, x.target]);
  assert.deepEqual(strip(named), strip(plain));
  const expect = View.wordsFor({ verdict_words: words });
  assert.deepEqual(Object.keys(expect).sort(), ['below_target', 'fail', 'pass', 'unverified']);
  for (const k of Object.keys(expect)) assert.ok(expect[k].length > 0, 'a blank word never replaces a label');
});

/* the view must not hand back a stale answer when a row changes but the row counts do not */
test('the hub view re-scores when a row value changes but the number of rows stays the same', () => {
  const base = {
    'BLD-score_scheme.csv': [{ id: 's1', status: 'active', effective_from: '2026-01-01' }],
    'BLD-score_band.csv': [{ id: 'g', scheme_id: 's1', kind: 'gate' }],
    'BLD-score_criterion.csv': [{ id: 'c', scheme_id: 's1', band_id: 'g', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on' }],
    'BLD-score_point.csv': [{ id: 'p', criterion_id: 'c', answer_match: 'is:ok', gate_outcome: 'pass' }, { id: 'q', criterion_id: 'c', answer_match: 'any', gate_outcome: 'fail' }],
    'BLD-score_enrolment.csv': [{ id: 'e', scheme_id: 's1', subject_id: 'a1' }],
    'BLD-subject.csv': [{ id: 'a1', name: 'TestA' }],
    'BLD-exam.csv': [{ id: 'x', subject_id: 'a1', r: 'ok', on: '2026-01-02' }]
  };
  assert.equal(View.compute({ T: base, today: '2026-07-01' }).results[0].verdict, 'pass');
  const changed = Object.assign({}, base, { 'BLD-exam.csv': [{ id: 'x', subject_id: 'a1', r: 'poor', on: '2026-01-02' }] });
  assert.equal(View.compute({ T: changed, today: '2026-07-01' }).results[0].verdict, 'fail');
});

/* the order rows arrive in never changes the answer (records with distinct dates) */
forAll('property: shuffling the record rows never changes the result', (r) => {
  const set = makeScheme(r, { target: String(r.int(0, 20)) });
  const rows = [];
  set.criteria.forEach((c, i) => {
    const n = r.int(0, 3), used = {};
    for (let j = 0; j < n; j++) {
      let d = recent(r); while (used[d]) d = recent(r); used[d] = 1;
      rows.push(exam(c.id + j, c.id, c.band_id === 'G' ? r.pick(['ok', 'bad', 'nr']) : r.pick(['top', 'mid', 'low']), d));
    }
  });
  const shuffled = rows.slice().sort(() => r.next() - 0.5);
  const a = run(set, rows), b = run(set, shuffled);
  for (const k of ['verdict', 'gate_result', 'points_earned', 'points_available', 'points_unverified']) assert.deepEqual(b[k], a[k], k);
});

/* a draft, retired or future scheme is never used; a breed's own scheme beats the species one */
forAll('property: only an active scheme in force is picked, and the breed scheme wins', (r) => {
  const asOf = r.date(2025, 2026);
  const species = { id: 'sp', status: 'active', species_id: 'x', effective_from: r.date(2020, 2024) };
  const breed = { id: 'br', status: 'active', species_id: 'x', breed: 'B1', effective_from: r.date(2020, 2024) };
  const noise = [
    { id: 'd', status: 'draft', species_id: 'x', breed: 'B1', effective_from: '2020-01-01' },
    { id: 'f', status: 'active', species_id: 'x', breed: 'B1', effective_from: '2027-06-01' },
    { id: 'o', status: 'active', species_id: 'x', breed: 'B1', effective_from: '2019-01-01', to_date: '2019-12-31' },
    { id: 'y', status: 'active', species_id: 'other', breed: 'B1', effective_from: '2020-01-01' }
  ];
  const all = [species, breed].concat(noise).sort(() => r.next() - 0.5);
  assert.equal(Score.pickScheme(all, 'x', 'B1', asOf).id, 'br');
  assert.equal(Score.pickScheme(all, 'x', 'B2', asOf).id, 'sp');
  assert.equal(Score.pickScheme(noise, 'x', 'B1', asOf), null);
});

/* bad rule rows are always caught before anything is scored */
forAll('property: a rule row with a broken value is refused, never scored', (r) => {
  const set = makeScheme(r, { gates: 1, lines: 1 });
  const breakers = [
    (s) => { s.criteria[0].when_missing = 'maybe'; },
    (s) => { s.criteria[1].reads = 'average'; },
    (s) => { s.criteria[0].valid_months = '1.5'; },
    (s) => { s.criteria[0].due_soon_days = '30'; },
    (s) => { s.criteria[1].lapsed_affects_verdict = 'yes'; },
    (s) => { s.criteria[1].age_weight = '0-11:2'; },
    (s) => { s.criteria[1].from_date = '1 Mar 2026'; },
    (s) => { s.criteria[1].from_date = '2026-05-01'; s.criteria[1].to_date = '2026-04-01'; },
    (s) => { s.points[0].gate_outcome = 'maybe'; },
    (s) => { s.points.find((p) => p.criterion_id === 'p0').points = 'ten'; },
    (s) => { s.points[0].answer_match = 'like:ok'; },
    (s) => { s.criteria[0].band_id = 'nowhere'; },
    (s) => { s.scheme.target_is = 'stars'; }
  ];
  const broken = JSON.parse(JSON.stringify(set));
  r.pick(breakers)(broken);
  assert.ok(validateScheme(broken).length > 0);
  assert.throws(() => run(broken, []), /The rules have problems/);
  assert.equal(validateScheme(set).length, 0);
});

/* pinned regressions for the fixes made in this job */
test('regression: an unmatched gate answer with when_missing fail is Unverified, not Fail', () => {
  const set = makeScheme(rng(1), { gates: 1, lines: 1, gateMissing: 'fail' });
  const out = run(set, [exam('e', 'g0', 'Grade Q', '2025-01-01'), exam('l', 'p0', 'top', '2025-01-01')]);
  assert.equal(out.lines[0].gate_outcome, 'unverified');
  assert.equal(out.verdict, 'unverified');
  // but a missing record with when_missing fail still fails, as the row says
  assert.equal(run(set, [exam('l', 'p0', 'top', '2025-01-01')]).verdict, 'fail');
});

test('regression: an unmatched points answer with when_missing zero is held, a missing record is 0', () => {
  const set = makeScheme(rng(2), { gates: 1, lines: 1, lineMissing: 'zero' });
  const odd = run(set, [exam('e', 'g0', 'ok', '2025-01-01'), exam('l', 'p0', 'Grade Q', '2025-01-01')]);
  assert.equal(odd.lines[1].points, '');
  assert.equal(odd.lines[1].unknown_reason, 'no_rule_for_answer');
  const none = run(set, [exam('e', 'g0', 'ok', '2025-01-01')]);
  assert.equal(none.lines[1].points, 0);
});

test('regression: tenths add up to tidy totals (0.1 + 0.2 + 0.3 = 0.6) and 100% of 0.6 is 0.6', () => {
  const crits = [0, 1, 2].map((i) => ({ id: 'p' + i, band_id: 'P', evidence_source: 'exam', evidence_match: 'kind=p' + i, answer_field: 'result', date_field: 'on' }));
  const pts = [0, 1, 2].map((i) => ({ id: 'x' + i, criterion_id: 'p' + i, answer_match: 'any', points: ['0.1', '0.2', '0.3'][i] }));
  const out = run({ scheme: { id: 's1', target_points: '100', target_is: 'percent' }, bands: [{ id: 'P', kind: 'points' }], criteria: crits, points: pts },
    [0, 1, 2].map((i) => exam('r' + i, 'p' + i, 'yes', '2025-01-01')));
  assert.equal(out.points_earned, 0.6);
  assert.equal(out.target, 0.6);
  assert.equal(out.verdict, 'pass');
  assert.equal(targetFor({ target_points: '150', target_is: 'percent' }, 10), 15, 'over 100% is kept as written');
  assert.equal(targetFor({ target_points: '70', target_is: 'percent' }, 7), 5, 'whole points still round up');
});
