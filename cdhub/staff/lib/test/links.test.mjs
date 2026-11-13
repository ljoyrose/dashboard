// BFFs / Fren. links (Lisa 13 Nov 2026): one row per pair, read both ways, dated, kinds and words from rule rows. Invented rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const L = createRequire(import.meta.url)('../links.js');

const rules = [
  { rule_key: 'link_kind.bff', value: 'BFFs', effective_from: '2026-01-01' },
  { rule_key: 'link_kind.not_with', value: 'Fren.', effective_from: '2026-01-01' },
  { rule_key: 'size_from_kg.large', value: '25', effective_from: '2026-01-01' }
];
const rows = [
  { subject_id: 'a', other_subject_id: 'b', kind: 'bff', from_date: '2026-11-01', to_date: '' },
  { subject_id: 'c', other_subject_id: 'a', kind: 'not_with', from_date: '2026-11-01', to_date: '' },
  { subject_id: 'a', other_subject_id: 'd', kind: 'bff', from_date: '2026-01-01', to_date: '2026-10-31' },
  { subject_id: 'a', other_subject_id: 'e', kind: 'bff', from_date: '2026-12-01', to_date: '' }
];

test('a link reads both ways, grouped by kind in the rule rows order, with the rule word', () => {
  assert.deepEqual(L.forDog(rows, rules, 'a', '2026-11-13'), [{ kind: 'bff', label: 'BFFs', ids: ['b'] }, { kind: 'not_with', label: 'Fren.', ids: ['c'] }]);
  assert.deepEqual(L.forDog(rows, rules, 'c', '2026-11-13'), [{ kind: 'not_with', label: 'Fren.', ids: ['a'] }]);
});
test('a past day is judged by the rows in force then (to_date included); a future row does not count yet', () => {
  assert.deepEqual(L.forDog(rows, rules, 'a', '2026-10-31'), [{ kind: 'bff', label: 'BFFs', ids: ['d'] }]);
  assert.deepEqual(L.forDog(rows, rules, 'e', '2026-11-13'), []);
});
test('no rule row for a kind: it still shows, under its own key; no rows at all: nothing', () => {
  assert.deepEqual(L.forDog([{ subject_id: 'a', other_subject_id: 'b', kind: 'litter_mate' }], rules, 'a', '2026-11-13'), [{ kind: 'litter_mate', label: 'litter_mate', ids: ['b'] }]);
  assert.deepEqual(L.forDog([], rules, 'a', '2026-11-13'), []);
  assert.deepEqual(L.kinds(rules, '2026-11-13').map((k) => k.label), ['BFFs', 'Fren.']);
});
