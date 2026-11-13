'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Dna = require('../../breed-better/dna-panel.js');

const esc = (s) => String(s).replace(/[&<>"]/g, '');
/* invented test rows in the live column shape; no real dogs */
const T = {
  'BLD-dna_marker.csv': [
    { code: 'TESTR', name: 'Recessive example', inheritance_mode: 'autosomal recessive', copies_0: 'clear', copies_1: 'carrier', copies_2: 'affected', breeding_rule: 'Never carrier x carrier.', source: 'example source' },
    { code: 'TESTD', name: 'Dominant example', inheritance_mode: 'dominant risk factor (dose)', copies_0: 'none', copies_1: 'AT RISK', copies_2: 'AT RISK, two copies', breeding_rule: 'One copy is enough.' },
    { code: 'TESTX', name: 'X-linked example', inheritance_mode: 'X-linked recessive' }],
  'BLD-dna_result.csv': [
    { subject_id: 'a1', marker_code: 'TESTR', copies: '1', genotype: 'N/r', tested_on: '2026-03-02', lab: 'Lab A' },
    { subject_id: 'a1', marker_code: 'testd', copies: '1' },
    { subject_id: 'a1', marker_code: 'OTHER', interpretation: 'Clear' },
    { subject_id: 'a2', marker_code: 'TESTR', copies: '0' }]
};

test('a recessive test: 1 copy carries; a dominant or risk-factor test: 1 copy is enough', () => {
  const m = Dna.markers(T);
  assert.equal(Dna.kindOf(m.testr, 1), 'carrier');
  assert.equal(Dna.kindOf(m.testr, 2), 'affected');
  assert.equal(Dna.kindOf(m.testd, 1), 'affected');
  assert.equal(Dna.kindOf(m.testd, 0), 'clear');
  assert.equal(Dna.kindOf(null, null), 'unknown');
});

test('copies come from the copies cell, else from the lab words', () => {
  assert.equal(Dna.copiesOf({ copies: '2' }), 2);
  assert.equal(Dna.copiesOf({ interpretation: 'Clear' }), 0);
  assert.equal(Dna.copiesOf({ interpretation: 'Carrier' }), 1);
  assert.equal(Dna.copiesOf({ interpretation: 'Affected' }), 2);
  assert.equal(Dna.copiesOf({ interpretation: 'see report' }), null);
});

test('results are worst first, with the marker row words; an unknown marker says so', () => {
  const r = Dna.results(T, 'a1');
  assert.deepEqual(r.map((x) => [x.code, x.kind]), [['testd', 'affected'], ['TESTR', 'carrier'], ['OTHER', 'clear']]);
  assert.equal(r[1].meaning, 'carrier');
  assert.equal(Dna.worst(r), 'affected');
  const html = Dna.card(T, 'a1', esc);
  assert.match(html, /1 Clear[\s\S]*1 Carrier[\s\S]*1 Affected or at risk/);
  assert.match(html, /N\/r: carrier · 2 Mar 2026 · Lab A/);
  assert.match(html, /test not in the marker list/);
  assert.equal(Dna.card(T, 'a3', esc), '');
});

test('probability per puppy follows each parent passing the variant at copies / 2', () => {
  assert.deepEqual(Dna.perPuppy(1, 1), { 0: 0.25, 1: 0.5, 2: 0.25 });
  assert.deepEqual(Dna.perPuppy(0, 1), { 0: 0.5, 1: 0.5, 2: 0 });
  assert.deepEqual(Dna.perPuppy(2, 0), { 0: 0, 1: 1, 2: 0 });
});

test('the calculator offers only tests it can work, and shows the row breeding rule and source', () => {
  assert.deepEqual(Dna.calcMarkers(T).map((m) => m.code), ['TESTR', 'TESTD']);
  const html = Dna.calc(T, { code: 'TESTR', sire: 1, dam: 1 }, esc);
  assert.match(html, /clear[\s\S]*25%[\s\S]*carrier[\s\S]*50%[\s\S]*affected[\s\S]*25%/);
  assert.match(html, /Never carrier x carrier\./);
  assert.match(html, /Source: example source/);
  assert.doesNotMatch(html, /TESTX/);
});
