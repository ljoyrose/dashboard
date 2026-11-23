'use strict';
/** Dog card Documents (Lisa 17 Nov 2026): files linked from the dog, labelled by BLD-doc_type rows; photos, ended and other dogs' links left out. */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../cdhub/docs-view.js');

const ID = (n) => '1FAKEDOCFILEIDFORTESTS0000000000' + n;
const files = [
  { id: 'f1', name: 'pedigree.pdf', drive_file_id: ID('a'), taken_on: '2024-05-01' },
  { id: 'f2', name: 'hips.pdf', drive_file_id: ID('b'), taken_on: '2026-02-10' },
  { id: 'f3', name: 'photo.jpg', drive_file_id: ID('c') },
  { id: 'f4', name: 'old.pdf', drive_file_id: ID('d'), taken_on: '2025-01-01' },
  { id: 'f5', name: 'other.pdf', drive_file_id: ID('e') },
  { id: 'f6', name: 'later.pdf', drive_file_id: ID('f') },
  { id: 'f7', name: 'nolink.pdf', drive_file_id: 'short' },
];
const L = (role, to, extra) => Object.assign({ from_table: 'subjects', from_id: 'd1', role, to_table: 'files', to_id: to, from_date: '2026-01-01', to_date: '' }, extra || {});
const links = [
  L('pedigree', 'f1'),
  L('ofa-hips', 'f2'),
  L('gallery', 'f3'),
  L('main', 'f3'),
  L('vet-history', 'f4', { to_date: '2026-02-01' }),
  L('pedigree', 'f5', { from_id: 'd2' }),
  L('pedigree', 'f6', { from_date: '2026-12-01' }),
  L('mystery_paper', 'f7'),
  L('lab-report', 'f5', { from_table: 'subject', from_id: 'd1', from_date: '2026-02-20' }),
];
const docTypes = [{ code: 'pedigree', label: 'Pedigree' }, { code: 'ofa-hips', label: 'OFA Hips certificate' }];
const v = { today: '2026-03-02', links, files, docTypes };

test('documents: open links from this dog to files, newest first, labelled by the doc_type row', () => {
  const rows = V.forDog(v, 'd1');
  assert.deepEqual(rows.map((r) => [r.label, r.on]), [
    ['Lab report', '2026-02-20'],
    ['OFA Hips certificate', '2026-02-10'],
    ['Pedigree', '2024-05-01'],
  ]);
  assert.equal(rows[1].url, 'https://drive.google.com/file/d/' + ID('b') + '/view');
});

test('photos, ended links, future links, other dogs and files with no Drive link are left out', () => {
  const roles = V.forDog(v, 'd1').map((r) => r.role);
  ['gallery', 'main', 'vet-history', 'mystery_paper'].forEach((r) => assert.ok(!roles.includes(r), r));
  assert.equal(V.forDog(v, 'd2').length, 1);
  assert.equal(V.forDog(Object.assign({}, v, { today: '2026-12-02' }), 'd1').length, 4);
});

test('the section draws a count and a Drive link per document; none says so', () => {
  const h = V.html(Object.assign({ esc: String, dmy: (s) => s }, v), 'd1', '');
  assert.match(h, /<b>3<\/b> documents/);
  assert.match(h, new RegExp('href="https://drive.google.com/file/d/' + ID('a') + '/view"[^>]*data-doc="pedigree"[^>]*>Pedigree</a>'));
  assert.match(V.html(Object.assign({ esc: String, dmy: (s) => s }, v), 'nobody', ''), /no documents/);
});

test("files linked from the dog's own records show, named by the record (Lisa 18 Nov 2026)", () => {
  const recs = { check_log: [{ id: 'c1', subject_id: 'd1', check_type_id: 'ct-ftb', happened_at: '2026-02-15T10:00:00Z' }, { id: 'c2', subject_id: 'd2', check_type_id: 'ct-ftb' }] };
  const extra = [
    L('certificate', 'f2', { from_table: 'check_log', from_id: 'c1' }),
    L('certificate', 'f5', { from_table: 'check_log', from_id: 'c2' }),
    L('evidence', 'f1', { from_table: 'check_log', from_id: 'c1' }),
    L('certificate', 'f6', { from_table: 'check_log', from_id: 'nope' }),
  ];
  const w = Object.assign({}, v, { links: links.concat(extra), records: (t) => recs[t] || [], recordLabel: () => 'Fit to breed' });
  const rows = V.forDog(w, 'd1');
  assert.deepEqual(rows.map((r) => [r.label, r.on]), [
    ['Lab report', '2026-02-20'],
    ['Fit to breed certificate', '2026-02-10'],
    ['OFA Hips certificate', '2026-02-10'],
    ['Pedigree', '2024-05-01'],
  ]);
  assert.equal(V.forDog(w, 'd2').length, 2);
  assert.equal(V.forDog(Object.assign({}, w, { records: undefined }), 'd1').length, 3);
});
