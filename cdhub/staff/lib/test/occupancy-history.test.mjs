// Dated occupancy for area history (Lisa, 12 Nov 2026): a past stay shows on its dates,
// and a dog who has since left does not appear on the current list or in today's room.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
global.BLDNeeds = req('../needs.js');
const O = req('../occupancy.js');
const C = req('../capacity.js');

const AREA = 'area-h56';
const areas = [{ id: AREA, code: 'H5/6', grouping: 'H', group_sort: '1', use: 'Whelping, free access' }];
const cap = [
  { area_id: AREA, access_type: 'free', size_band: 'medium + pups', max_dogs: '1', from_date: '', to_date: '' },
  { area_id: AREA, access_type: 'free', size_band: '10-25kg (medium)', max_dogs: '3', from_date: '', to_date: '' }
];

// Three invented litters, no overlap: dam from DOB-10, pups from DOB, all until DOB+56.
const L = [
  { dam: 'sub-dam-a', pups: ['sub-pup-a1', 'sub-pup-a2'], dob: '2025-07-20', start: '2025-07-10', end: '2025-09-14' },
  { dam: 'sub-dam-b', pups: ['sub-pup-b1', 'sub-pup-b2'], dob: '2026-05-26', start: '2026-05-16', end: '2026-07-21' },
  { dam: 'sub-dam-c', pups: ['sub-pup-c1', 'sub-pup-c2'], dob: '2026-09-30', start: '2026-09-20', end: '2026-11-25' }
];

const subject = [];
const occupancy = [];
const subject_status = [];
function addDog(id, name, kind, state) {
  subject.push({ id, name, kind });
  if (state) subject_status.push({ subject_id: id, state, from_date: '', to_date: '' });
}
L.forEach((lit, i) => {
  addDog(lit.dam, 'Dam ' + i, 'Breeding Female', 'Active');
  occupancy.push({ id: 'occ-' + lit.dam + '-h', subject_id: lit.dam, area_id: AREA, off_site_kind: '', moved_in: lit.start, moved_out: lit.end, classification: '' });
  // dams A and B later return to another room; dam C is still in the whelping room today
  if (i < 2) occupancy.push({ id: 'occ-' + lit.dam + '-now', subject_id: lit.dam, area_id: 'area-other', off_site_kind: '', moved_in: '2026-11-11', moved_out: '', classification: '' });
  lit.pups.forEach((id) => {
    const gone = i < 2; // first two litters have since been collected
    addDog(id, id, 'Pup', gone ? 'Collected' : 'Active');
    occupancy.push({ id: 'occ-' + id + '-h', subject_id: id, area_id: AREA, off_site_kind: '', moved_in: lit.dob, moved_out: lit.end, classification: '' });
    if (gone) occupancy.push({ id: 'occ-' + id + '-out', subject_id: id, area_id: '', off_site_kind: 'sold', moved_in: lit.end, moved_out: '', classification: 'Collected' });
  });
});

const T = { area: areas.concat([{ id: 'area-other', code: '3B.1', group_sort: '2' }]), subject, subject_status, occupancy };

test('no date overlap between the three invented litter windows', () => {
  const spans = L.map((lit) => [lit.start, lit.end]);
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      assert.ok(spans[i][1] < spans[j][0] || spans[j][1] < spans[i][0], spans[i] + ' vs ' + spans[j]);
    }
  }
});

test('mid-window, the dam and her pups are in H5/6; other litters are not', () => {
  assert.deepEqual(O.inArea(occupancy, AREA, '2025-08-01').sort(), ['sub-dam-a', 'sub-pup-a1', 'sub-pup-a2']);
  assert.deepEqual(O.inArea(occupancy, AREA, '2026-06-15').sort(), ['sub-dam-b', 'sub-pup-b1', 'sub-pup-b2']);
  assert.deepEqual(O.inArea(occupancy, AREA, '2026-10-15').sort(), ['sub-dam-c', 'sub-pup-c1', 'sub-pup-c2']);
  // pups are not placed before their DOB; the dam is in from DOB-10
  assert.deepEqual(O.inArea(occupancy, AREA, '2025-07-15'), ['sub-dam-a']);
  assert.equal(O.rowOn(occupancy, 'sub-pup-a1', '2025-07-15'), null);
  assert.equal(O.rowOn(occupancy, 'sub-pup-a1', '2025-07-20').area_id, AREA);
});

test('after the window, and today, collected pups are gone; current dam C and her pups stay in H5/6', () => {
  assert.deepEqual(O.inArea(occupancy, AREA, '2025-09-15'), []);
  assert.deepEqual(O.inArea(occupancy, AREA, '2026-07-22'), []);
  const today = O.dailyList(T, '2026-11-12');
  const ids = today.dogs.map((d) => d.id).sort();
  assert.deepEqual(ids, ['sub-dam-a', 'sub-dam-b', 'sub-dam-c', 'sub-pup-c1', 'sub-pup-c2']);
  assert.ok(!ids.includes('sub-pup-a1') && !ids.includes('sub-pup-b1'));
  assert.equal(today.dogs.filter((d) => d.id === 'sub-dam-a')[0].areaId, 'area-other');
  assert.equal(today.dogs.filter((d) => d.id === 'sub-dam-c')[0].areaId, AREA);
  assert.deepEqual(O.inArea(occupancy, AREA, '2026-11-12').sort(), ['sub-dam-c', 'sub-pup-c1', 'sub-pup-c2']);
});

test('one dam with her litter is within the medium+pups limit; two litters in the same room would be over', () => {
  const dogs = (ids, damId) => ids.map((id) => ({ id, size: 'medium', damId: id === damId ? '' : damId }));
  const mid = dogs(['sub-dam-b', 'sub-pup-b1', 'sub-pup-b2'], 'sub-dam-b');
  const one = C.check({ areaId: AREA, access: 'free', capacity: cap, dogs: mid, date: '2026-06-15' });
  assert.equal(one.status, 'ok');
  assert.equal(one.count, 1);
  const two = C.check({
    areaId: AREA, access: 'free', capacity: cap, date: '2026-06-15',
    dogs: mid.concat(dogs(['sub-dam-a', 'sub-pup-a1'], 'sub-dam-a'))
  });
  assert.equal(two.status, 'over');
  assert.equal(two.count, 2);
});

test('a leave dated after today does not hide a pup who is still here', () => {
  const extra = occupancy.concat([
    { id: 'occ-pup-c1-future', subject_id: 'sub-pup-c1', area_id: '', off_site_kind: 'sold', moved_in: '2026-11-25', moved_out: '', classification: 'Collected' }
  ]);
  const T2 = { area: T.area, subject, subject_status, occupancy: extra };
  const today = O.dailyList(T2, '2026-11-12');
  assert.ok(today.dogs.some((d) => d.id === 'sub-pup-c1'));
  assert.equal(O.rowOn(extra, 'sub-pup-c1', '2026-11-12').area_id, AREA);
  assert.equal(O.rowOn(extra, 'sub-pup-c1', '2026-11-25'), null);
});
