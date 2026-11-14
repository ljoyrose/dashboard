// Main photo + gallery (Lisa 13 Nov 2026): files rows, ownership through dated link rows (decision C). Invented rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const P = createRequire(import.meta.url)('../photos.js');

const files = [
  { id: 'f1', kind: 'photo', drive_file_id: 'DRIVEaaaa1' },
  { id: 'f2', kind: 'photo', drive_file_id: 'DRIVEbbbb2' },
  { id: 'f3', kind: 'upload', drive_file_id: 'DRIVEcccc3', name: 'cert.pdf', mime: 'application/pdf' },
  { id: 'f4', kind: 'link', url: 'https://example.org/video' },
  { id: 'f5', kind: 'photo', drive_file_id: 'DRIVEeeee5' }
];
const kinds = [
  { rule_key: 'link_kind.gallery', value: 'Photos', effective_from: '2026-01-01' },
  { rule_key: 'link_kind.main', value: 'Main photo', effective_from: '2026-01-01' },
  { rule_key: 'link_kind.main.max_per_from', value: '1', effective_from: '2026-01-01' }
];
const L = (id, to, key, from, toDate, extra) => Object.assign({ id, from_table: 'subjects', from_id: 'dog-a', to_table: 'files', to_id: to, role: key, from_date: from, to_date: toDate || '' }, extra || {});
const links = [
  L('l1', 'f1', 'gallery', '2025-01-01', '', { set_on: '2025-01-01T10:00:00Z' }),
  L('l2', 'f2', 'gallery', '2026-06-01', '', { set_on: '2026-06-01T10:00:00Z' }),
  L('l3', 'f3', 'gallery', '2026-07-01', '', { set_on: '2026-07-01T10:00:00Z' }),
  L('l4', 'f4', 'gallery', '2026-08-01', '', { set_on: '2026-08-01T10:00:00Z' }),
  L('l5', 'f5', 'gallery', '2025-02-01', '2026-03-01', { set_on: '2025-02-01T10:00:00Z' }),
  L('m1', 'f1', 'main', '2025-01-01', '2026-06-01', { set_on: '2025-01-01T10:00:00Z' }),
  L('m2', 'f2', 'main', '2026-06-01', '', { set_on: '2026-06-01T11:00:00Z' }),
  L('x1', 'f1', 'gallery', '2025-01-01', '', { from_id: 'dog-b' }),
  L('x2', 'missing', 'gallery', '2025-01-01', '')
];

test('main is the main link in force; on a change-over day the later set_on wins', () => {
  assert.equal(P.forRecord(links, files, kinds, 'subjects', 'dog-a', '2026-11-14').main.id, 'f2');
  assert.equal(P.forRecord(links, files, kinds, 'subjects', 'dog-a', '2026-06-01').main.id, 'f2');
  assert.equal(P.forRecord(links, files, kinds, 'subjects', 'dog-a', '2026-05-31').main.id, 'f1');
  assert.equal(P.forRecord(links, files, kinds, 'subjects', 'dog-a', '2024-12-31').main, null);
});

test('gallery: open links only, newest first; ended links listed apart; other records and missing files left out', () => {
  const r = P.forRecord(links, files, kinds, 'subjects', 'dog-a', '2026-11-14');
  assert.deepEqual(r.gallery.map((f) => f.id), ['f4', 'f3', 'f2', 'f1']);
  assert.deepEqual(r.ended.map((f) => f.id), ['f5']);
  assert.equal(r.gallery[0].link_id, 'l4');
  assert.equal(r.galleryLabel, 'Photos');
  assert.equal(r.mainLabel, 'Main photo');
});

test('a numbered sort comes first, in number order', () => {
  const sorted = links.map((l) => (l.id === 'l1' ? Object.assign({}, l, { sort: '2' }) : l.id === 'l3' ? Object.assign({}, l, { sort: '1' }) : l));
  assert.deepEqual(P.forRecord(sorted, files, kinds, 'subjects', 'dog-a', '2026-11-14').gallery.map((f) => f.id), ['f3', 'f1', 'f4', 'f2']);
});

test('no link_kind rule rows: no label (the page uses its own fallback); unsafe link addresses are refused', () => {
  assert.equal(P.forRecord(links, files, [], 'subjects', 'dog-a', '2026-11-14').galleryLabel, '');
  assert.equal(P.safeUrl('https://example.org/a'), 'https://example.org/a');
  assert.equal(P.safeUrl('javascript:alert(1)'), '');
  assert.equal(P.safeUrl('https://x.org/"onmouseover'), '');
});
