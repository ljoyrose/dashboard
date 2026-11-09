'use strict';
const test = require('node:test');
const assert = require('node:assert');
const View = require('../hub-view.js');

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
