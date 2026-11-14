'use strict';
/**
 * Breed Better schema contract (JOB BB-FIN.1, 12 Nov 2026). Fails if a column the calculator or the hub view needs
 * is renamed or dropped. Header fixture only (tests/fixtures/breed-better/headers.json): no values, nothing real.
 * REQUIRED = the page cannot work without it. OPTIONAL = read when present, blank when absent (dated rows, new settings).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { score } = require('../../breed-better/score');

const ROOT = path.resolve(__dirname, '..', '..');
const HEADERS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/breed-better/headers.json'), 'utf8'));
const SOURCE = ['breed-better/score.js', 'breed-better/hub-view.js'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

const CONTRACT = {
  'BLD-score_scheme.csv': { required: ['id', 'name', 'species_id', 'breed', 'version', 'effective_from', 'status'], optional: ['target_points', 'target_is', 'verdict_words', 'to_date'] },
  'BLD-score_band.csv': { required: ['id', 'scheme_id', 'kind', 'label'], optional: ['colour', 'sort_order'] },
  'BLD-score_criterion.csv': { required: ['id', 'scheme_id', 'band_id', 'label', 'evidence_source', 'answer_field'],
    optional: ['key', 'subject_field', 'evidence_match', 'date_field', 'reads', 'applies_to', 'valid_months', 'when_missing', 'lapsed_affects_verdict', 'due_soon_days', 'age_weight', 'from_date', 'to_date'] },
  'BLD-score_point.csv': { required: ['id', 'criterion_id', 'answer_match', 'points', 'gate_outcome'], optional: ['from_date', 'to_date'] },
  'BLD-score_enrolment.csv': { required: ['id', 'scheme_id', 'subject_id'], optional: ['valid_from', 'is_active', 'to_date'] },
  'BLD-subject.csv': { required: ['id', 'name'], optional: ['dob'] }  /* sex and others are named by applies_to rows, not by code */
};

/** The checker: which required columns are missing from a header row. */
function missing(file, header) { return CONTRACT[file].required.filter((c) => header.indexOf(c) < 0); }

test('contract: every required column is in the live-shaped header rows', () => {
  for (const file of Object.keys(CONTRACT)) assert.deepEqual(missing(file, HEADERS[file] || []), [], file);
});

test('contract: renaming or dropping any required column is caught', () => {
  let cases = 0;
  for (const file of Object.keys(CONTRACT)) {
    for (const col of CONTRACT[file].required) {
      const renamed = HEADERS[file].map((h) => (h === col ? col + '_renamed' : h));
      assert.deepEqual(missing(file, renamed), [col], file + ' ' + col);
      assert.deepEqual(missing(file, HEADERS[file].filter((h) => h !== col)), [col]);
      cases++;
    }
  }
  assert.ok(cases >= 25);
});

test('contract: every column named in the contract is really read by the code (the list cannot drift)', () => {
  for (const file of Object.keys(CONTRACT)) {
    for (const col of CONTRACT[file].required.concat(CONTRACT[file].optional)) {
      assert.match(SOURCE, new RegExp('\\.' + col + '\\b|[\'"]' + col + '[\'"]'), file + ': ' + col + ' is in the contract but the code never reads it');
    }
  }
});

test('contract: the hub fixtures carry every required score column', () => {
  for (const file of Object.keys(CONTRACT).filter((f) => /score_/.test(f))) {
    const head = fs.readFileSync(path.join(ROOT, 'tests/fixtures/breed-better', file), 'utf8').split(/\r?\n/)[0].split(',');
    assert.deepEqual(missing(file, head), [], file);
  }
});

test('contract: optional columns may be absent; the calculator reads them as blank', () => {
  const crit = { id: 'c', band_id: 'g', label: 'Check', evidence_source: 'exam', answer_field: 'r' };
  const out = score({ scheme: { id: 's' }, bands: [{ id: 'g', kind: 'gate' }], criteria: [crit],
    points: [{ id: 'p', criterion_id: 'c', answer_match: 'is:ok', gate_outcome: 'pass' }],
    subject: { id: 'a' }, evidence: { exam: [{ id: 'x', subject_id: 'a', r: 'ok' }] }, asOf: '2026-06-01' });
  assert.equal(out.verdict, 'pass');
});
