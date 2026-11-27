// Main photo + gallery (the owner 13 Nov 2026): files rows, ownership through dated link rows (decision C). Invented rows.
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

test('a main link stored as subject (not subjects) is the chosen photo', () => {
  const singular = links.map((l) => Object.assign({}, l, { from_table: 'subject' }));
  assert.equal(P.forRecord(singular, files, kinds, 'subjects', 'dog-a', '2026-11-14').main.id, 'f2');
  assert.equal(P.forRecord(singular, files, kinds, 'subject', 'dog-a', '2026-11-14').main.id, 'f2');
});

test('main is the main link in force; on a change-over day the later set_on wins', () => {
  assert.equal(P.forRecord(links, files, kinds, 'subjects', 'dog-a', '2026-11-14').main.id, 'f2');
  assert.equal(P.forRecord(links, files, kinds, 'subjects', 'dog-a', '2026-06-01').main.id, 'f2');
  assert.equal(P.forRecord(links, files, kinds, 'subjects', 'dog-a', '2026-05-31').main.id, 'f1');
  assert.equal(P.forRecord(links, files, kinds, 'subjects', 'dog-a', '2024-12-31').main, null);
});

test('gallery: open links only, newest first; ended links listed apart; other records and missing files left out', () => {
  const r = P.forRecord(links, files, kinds, 'subjects', 'dog-a', '2026-11-14');
  assert.deepEqual(r.gallery.map((f) => f.id), ['f4', 'f3', 'f2', 'f1']);
  assert.deepEqual(r.ended.map((f) => f.id), ['f1', 'f5']);
  assert.equal(r.gallery[0].link_id, 'l4');
  assert.equal(r.galleryLabel, 'Photos');
  assert.equal(r.mainLabel, 'Main photo');
});

test('a main link removed today is not the card photo; a past main is ended the same way', () => {
  const day = '2026-11-14';
  const removed = links.map((l) => (l.id === 'm2' ? Object.assign({}, l, { to_date: day, end_reason: 'Removed from gallery' }) : l));
  const r = P.forRecord(removed, files, kinds, 'subjects', 'dog-a', day);
  assert.equal(r.main, null);
  assert.ok(r.ended.some((f) => f.link_id === 'm2' && f.id === 'f2'));
  assert.ok(r.ended.some((f) => f.link_id === 'm1' && f.id === 'f1'));
  assert.equal(r.gallery.some((f) => f.id === 'f2'), true);
  const still = links.map((l) => (l.id === 'm2' ? Object.assign({}, l, { to_date: day }) : l));
  assert.equal(P.forRecord(still, files, kinds, 'subjects', 'dog-a', day).main.id, 'f2');
});

test('a numbered sort comes first, in number order', () => {
  const sorted = links.map((l) => (l.id === 'l1' ? Object.assign({}, l, { sort: '2' }) : l.id === 'l3' ? Object.assign({}, l, { sort: '1' }) : l));
  assert.deepEqual(P.forRecord(sorted, files, kinds, 'subjects', 'dog-a', '2026-11-14').gallery.map((f) => f.id), ['f3', 'f1', 'f4', 'f2']);
});

test('a removed or ended photo is left out of the gallery and is not the shown photo', () => {
  const day = '2026-11-14';
  const rows = links.concat([
    L('l9', 'f1', 'gallery', '2026-11-14', '2026-11-14', { end_reason: 'Removed from gallery', set_on: '2026-11-14T12:00:00Z' }),
    L('m9', 'f5', 'main', '2026-11-14', '2026-11-14', { end_reason: 'Removed from gallery', set_on: '2026-11-14T12:00:00Z' })
  ]);
  const blank = files.concat([{ id: 'f9', kind: 'photo', drive_file_id: '' }]);
  const withBlank = rows.concat([L('l8', 'f9', 'gallery', '2026-11-01', '', { set_on: '2026-11-01T00:00:00Z' })]);
  const r = P.forRecord(withBlank, blank, kinds, 'subjects', 'dog-a', day);
  assert.equal(r.gallery.some((f) => f.id === 'f5' || f.id === 'f9'), false);
  assert.notEqual(r.main && r.main.id, 'f5');
  assert.equal(P.shownPhoto(r, 'DRIVEeeee5'), 'DRIVEbbbb2');
  const gone = P.forRecord([
    L('lg', 'f5', 'gallery', '2025-02-01', '2026-03-01', { end_reason: 'Removed from gallery' }),
    L('mg', 'f5', 'main', '2025-02-01', '', { set_on: '2026-06-01T00:00:00Z' })
  ], files, kinds, 'subjects', 'dog-a', day);
  assert.equal(gone.gallery.length, 0);
  assert.equal(P.shownPhoto(gone, 'DRIVEeeee5'), '');
});

test('no link_kind rule rows: no label (the page uses its own fallback); unsafe link addresses are refused', () => {
  assert.equal(P.forRecord(links, files, [], 'subjects', 'dog-a', '2026-11-14').galleryLabel, '');
  assert.equal(P.safeUrl('https://example.org/a'), 'https://example.org/a');
  assert.equal(P.safeUrl('javascript:alert(1)'), '');
  assert.equal(P.safeUrl('https://x.org/"onmouseover'), '');
});

// A dated owner setting row photo.rotate.<file>. The stored picture never changes. Invented rows.
test('photo turn: the row in force on the day, found by files row id or file id; bad values and other photos ignored', () => {
  const fl = [{ id: 'fil-1', drive_file_id: 'FILEturn0001' }, { id: 'fil-2', drive_file_id: 'FILEturn0002' }];
  const R = (key, value, from, to) => ({ rule_key: key, value, effective_from: from, to_date: to || '' });
  const rules = [R('photo.rotate.fil-1', '90', '2026-11-10'), R('photo.rotate.fil-1', '270', '2026-11-16'),
    R('photo.rotate.fil-2', '45', '2026-11-10'), R('photo.rotate.fil-2', '180', '2026-11-01', '2026-11-05')];
  assert.equal(P.rotation(fl, rules, 'fil-1', '2026-11-12'), 90);
  assert.equal(P.rotation(fl, rules, 'FILEturn0001', '2026-11-16'), 270);
  assert.equal(P.rotation(fl, rules, 'FILEturn0001', '2026-11-09'), 0);
  assert.equal(P.rotation(fl, rules, 'FILEturn0002', '2026-11-03'), 180);
  assert.equal(P.rotation(fl, rules, 'FILEturn0002', '2026-11-12'), 0);
  assert.equal(P.rotation(fl, rules, 'FILEnoRow999', '2026-11-12'), 0);
  assert.equal(P.rotation(fl, rules, '', '2026-11-12'), 0);
  assert.equal(P.rotateKey('FIL-1'), 'photo.rotate.fil-1');
  assert.deepEqual([P.turned(0, 1), P.turned(0, -1), P.turned(270, 1), P.turned(90, -1)], [90, 270, 0, 0]);
  assert.equal(P.turnStyle(0, 100, 50), '');
  assert.equal(P.turnStyle(180, 100, 50), 'transform:rotate(180deg)');
  assert.match(P.turnStyle(90, 100, 50), /width:50px;height:100px;.*rotate\(90deg\)/);
});
