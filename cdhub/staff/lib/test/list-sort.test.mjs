// BLDSort (Lisa 15 Nov 2026: a list offers only the sorts it has fields for; best to worst by default). Invented rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const S = createRequire(import.meta.url)('../list-sort.js');
const ids = (f) => S.options(f).map((o) => o[0]);

test('a list only offers the sorts it has fields for', () => {
  assert.deepEqual(ids({ dob: 1, name: 1 }), ['young', 'old', 'name', '']);
  assert.deepEqual(ids({ status: 1, due: 1, made: 1, name: 1 }), ['best', 'due', 'newest', 'oldest', 'name', '']);
  assert.deepEqual(ids({}), ['']);
  assert.ok(!ids({ made: 1 }).includes('young'), 'no Youngest on a list without a date of birth');
});

test('default: best to worst, else due soonest, else A to Z, else as on file', () => {
  assert.equal(S.byDefault({ status: 1, due: 1, name: 1 }), 'best');
  assert.equal(S.byDefault({ due: 1, name: 1 }), 'due');
  assert.equal(S.byDefault({ name: 1 }), 'name');
  assert.equal(S.byDefault({}), '');
});

const ROWS = [
  { n: 'b', s: 2, d: '2026-03-02', m: '2025-01-01' },
  { n: 'A', s: 0, d: '', m: '2026-01-01' },
  { n: 'c', s: null, d: '2026-01-05', m: '' },
  { n: 'd', s: 0, d: '2026-01-05', m: '2024-06-01' }
];
const GET = { status: (r) => r.s, due: (r) => r.d, made: (r) => r.m, dob: (r) => r.m, name: (r) => r.n };
const order = (id) => S.sort(ROWS, id, GET).map((r) => r.n).join('');

test('best to worst puts the best first, never the worst; ties keep file order; blanks last', () => {
  assert.equal(order('best'), 'Adbc');
});
test('due soonest; blank dates last', () => assert.equal(order('due'), 'cdbA'));
test('newest and oldest made; blanks last both ways', () => {
  assert.equal(order('newest'), 'Abdc');
  assert.equal(order('oldest'), 'dbAc');
});
test('youngest and oldest by date of birth', () => {
  assert.equal(order('young'), 'Abdc');
  assert.equal(order('old'), 'dbAc');
});
test('A to Z ignores case', () => assert.equal(order('name'), 'Abcd'));
test('as on file, an unknown id or a missing getter leaves the order alone and copies', () => {
  assert.equal(order(''), 'bAcd');
  assert.equal(order('nope'), 'bAcd');
  assert.equal(S.sort(ROWS, 'due', {}).map((r) => r.n).join(''), 'bAcd');
  assert.notEqual(S.sort(ROWS, '', GET), ROWS);
});
