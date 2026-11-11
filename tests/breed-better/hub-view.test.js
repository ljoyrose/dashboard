'use strict';
const test = require('node:test');
const assert = require('node:assert');
const View = require('../../breed-better/hub-view.js');

const esc = (s) => String(s).replace(/[&<>"]/g, '');
function tables(extra) {
  return Object.assign({
    'BLD-score_scheme.csv': [{ id: 's1', status: 'active', effective_from: '2026-01-01' }],
    'BLD-score_band.csv': [{ id: 'g', scheme_id: 's1', kind: 'gate', label: 'Gates', colour: 'red', sort_order: '1' }, { id: 't', scheme_id: 's1', kind: '', label: 'TOTAL' }],
    'BLD-score_criterion.csv': [{ id: 'c', scheme_id: 's1', band_id: 'g', label: 'Check', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on' }],
    'BLD-score_point.csv': [{ id: 'p', criterion_id: 'c', answer_match: 'is:ok', gate_outcome: 'pass' }, { id: 'q', criterion_id: 'c', answer_match: 'any', gate_outcome: 'fail' }],
    'BLD-score_enrolment.csv': [{ id: 'e1', scheme_id: 's1', subject_id: 'a1' }, { id: 'e2', scheme_id: 's1', subject_id: 'a2' }],
    'BLD-subject.csv': [{ id: 'a1', name: 'Alpha' }, { id: 'a2', name: 'Beta' }, { id: 'a3', name: 'NotEnrolled' }],
    'BLD-exam.csv': [{ id: 'x', subject_id: 'a1', r: 'ok', on: '2026-01-02' }]
  }, extra);
}

test('only enrolled animals are scored, best first', () => {
  const c = View.compute({ T: tables(), today: '2026-06-01', esc });
  assert.deepEqual(c.results.map((r) => [r.name, r.gate_result]), [['Alpha', 'pass'], ['Beta', 'unverified']]);
  assert.equal(c.byId.a3, undefined);
});

test('the chip is empty for an animal not enrolled', () => {
  const v = { T: tables(), today: '2026-06-02', esc };
  assert.equal(View.chip(v, 'a3'), '');
  assert.match(View.chip(v, 'a1'), /data-go="breed"/);
});

test('with no enrolment rows the page says not set up', () => {
  const v = { T: tables({ 'BLD-score_enrolment.csv': [] }), today: '2026-06-03', esc };
  assert.match(View.page(v), /Not set up yet/);
});

test('a draft scheme scores nothing and says so', () => {
  const v = { T: tables({ 'BLD-score_scheme.csv': [{ id: 's1', status: 'draft', effective_from: '2026-01-01' }] }), today: '2026-06-04', esc };
  assert.match(View.page(v), /No active scheme/);
});

test('dates read like 2 Mar 2026', () => {
  assert.equal(View.day('2026-03-02'), '2 Mar 2026');
  assert.equal(View.day(''), '');
});

test('a scheme row can rename any verdict word', () => {
  const w = View.wordsFor({ verdict_words: 'unverified=To prove; below target=Under 65' });
  assert.equal(w.unverified, 'To prove');
  assert.equal(w.below_target, 'Under 65');
  assert.equal(w.pass, 'Pass');
});

test('filters run best to worst and the page shows target, dates and Due', () => {
  const T = tables({
    'BLD-score_scheme.csv': [{ id: 's1', status: 'active', effective_from: '2026-01-01', verdict_words: 'unverified=To prove' }],
    'BLD-score_criterion.csv': [{ id: 'c', scheme_id: 's1', band_id: 'g', label: 'Check', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on', valid_months: '12', lapsed_affects_verdict: 'FALSE' }]
  });
  const v = { T, today: '2027-02-01', esc };
  const html = View.page(v);
  assert.match(html, /All[\s\S]*Pass[\s\S]*Below target[\s\S]*To prove[\s\S]*Fail/);
  assert.doesNotMatch(html, /Unverified/);
  const c = View.compute(v);
  assert.equal(c.byId.a1.verdict, 'pass');
  assert.equal(c.byId.a1.lines[0].due, 'overdue');
  assert.match(View.page(v), /1 due/);
});

test('staff never see Breed Better: no staff, guest or print page loads it', () => {
  const fs = require('node:fs'), path = require('node:path');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const hits = walk(path.join(__dirname, '../../cdhub/staff')).filter((f) => /\.(html|js)$/.test(f) && /breed-better|BBHubView/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});

test('Fit to Breed is read from BLD-fit_to_breed, which the hub loads as an optional file', () => {
  assert.ok(View.FILES.includes('BLD-fit_to_breed.csv'));
  const T = tables({
    'BLD-score_criterion.csv': [{ id: 'c', scheme_id: 's1', band_id: 'g', label: 'Fit to Breed', evidence_source: 'BLD-fit_to_breed', answer_field: 'outcome', date_field: 'assessed_on' }],
    'BLD-score_point.csv': [{ id: 'p', criterion_id: 'c', answer_match: 'is:fit', gate_outcome: 'pass' }, { id: 'q', criterion_id: 'c', answer_match: 'any', gate_outcome: 'fail' }],
    'BLD-fit_to_breed.csv': [{ id: 'f1', subject_id: 'a1', outcome: 'fit', assessed_on: '2026-10-03' }]
  });
  const c = View.compute({ T, today: '2026-11-11', esc });
  assert.equal(c.byId.a1.verdict, 'pass');
  assert.equal(c.byId.a1.lines[0].date_then, '2026-10-03');
});
