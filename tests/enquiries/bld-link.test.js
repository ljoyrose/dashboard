// BLD links for puppy enquiries. Invented rows only: Sample Buyer A, Pup One, lit-001.
// Run: node --test tests/enquiries/bld-link.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');

const LITTERS = [
  { id: 'lit-001', external_ref: 'ab26', external_ref_system: 'allocation sheet', pairing: 'Pair A', dob: '2026-03-02' },
  { id: 'lit-002', external_ref: 'ab26', external_ref_system: 'other list', pairing: 'Pair B', dob: '2026-01-01' },
  { id: 'lit-003', external_ref: 'cd26', external_ref_system: 'Allocation Sheet', pairing: 'Pair C', dob: '2026-02-02' }
];
const SUBJECTS = [
  { id: 'sub-001-01', birth_litter_id: 'lit-001', name: 'Pup One' },
  { id: 'sub-001-1', birth_litter_id: 'lit-001', name: 'Pup One duplicate' },
  { id: 'sub-001-02', birth_litter_id: 'lit-001', name: 'Pup Two' },
  { id: 'sub-003-01', birth_litter_id: 'lit-003', name: 'Pup Three' },
  { id: 'sub-001-001', birth_litter_id: 'lit-001', name: 'Not the same number' }
];

test('version is 1.15.0', () => {
  assert.equal(C.VERSION, 'enquiries-core 1.15.0 (2026-11-13)');
});

test('bldLitterFor matches external_ref only when the system is the allocation sheet', () => {
  assert.equal(C.bldLitterFor('ab26', LITTERS), 'lit-001');
  assert.equal(C.bldLitterFor('cd26', LITTERS), 'lit-003');
  assert.equal(C.bldLitterFor('zz26', LITTERS), '');
  assert.equal(C.bldLitterFor('', LITTERS), '');
  assert.equal(C.bldLitterFor('ab26', [LITTERS[0], { id: 'lit-009', external_ref: 'ab26', external_ref_system: 'allocation sheet' }]), '');
});

test('bldSubjectFor matches the birth litter and the pup number in the id', () => {
  assert.equal(C.bldSubjectFor('ab26-02', 'lit-001', SUBJECTS), 'sub-001-02');
  assert.equal(C.bldSubjectFor('ab26-01', 'lit-001', SUBJECTS), '');
  assert.equal(C.bldSubjectFor('ab26-01', 'lit-003', SUBJECTS), 'sub-003-01');
  assert.equal(C.bldSubjectFor('ab26-01', 'lit-001', [{ id: 'sub-01', birth_litter_id: 'lit-001' }]), 'sub-01');
  assert.equal(C.bldSubjectFor('ab26-01', 'lit-001', [{ id: 'sub-001', birth_litter_id: 'lit-001' }]), '');
  assert.equal(C.bldSubjectFor('ab26-04', 'lit-001', SUBJECTS), '');
  assert.equal(C.bldSubjectFor('ab26-02', '', SUBJECTS), '');
});

test('plainStage uses the four plain words, and lost or parked is closed', () => {
  assert.deepEqual(C.PLAIN_STAGES, ['enquiry', 'deposit', 'working to collection', 'after collection']);
  ['new', 'replied', 'call-booked', 'call-held', 'offered'].forEach((s) => assert.equal(C.plainStage(s), 'enquiry', s));
  assert.equal(C.plainStage('deposit'), 'deposit');
  assert.equal(C.plainStage('balance'), 'working to collection');
  assert.equal(C.plainStage('collected'), 'after collection');
  assert.equal(C.plainStage('lost'), 'closed');
  assert.equal(C.plainStage('parked'), 'closed');
  assert.equal(C.plainStage({ stage: 'offered', bld_subject_id: 'sub-01' }), 'working to collection');
  assert.equal(C.plainStage('deposit', { bld_subject_id: 'sub-01' }), 'working to collection');
  assert.equal(C.plainStage({ stage: 'collected', bld_subject_id: 'sub-01' }), 'after collection');
  assert.equal(C.plainStage('asked'), '');
});

test('optional trailing columns load when missing and still refuse a moved required column', () => {
  const full = C.COLUMNS.Enquiries.slice();
  const old = full.slice(0, full.length - C.OPTIONAL_TAIL.Enquiries.length);
  assert.deepEqual(C.OPTIONAL_TAIL.Enquiries, ['bld_litter_id', 'bld_subject_id']);
  assert.deepEqual(C.OPTIONAL_TAIL.People, ['bld_person_id']);
  assert.deepEqual(C.OPTIONAL_TAIL.Litters, ['bld_litter_id', 'bld_subject_id']);
  assert.deepEqual(C.OPTIONAL_TAIL.Deposits, ['bld_litter_id']);
  const row = old.map(() => '');
  row[old.indexOf('key')] = 'K-0000000000000001';
  row[old.indexOf('channel')] = 'email';
  row[old.indexOf('kind')] = 'puppy';
  row[old.indexOf('stage')] = 'new';
  const kept = C.parseTab('Enquiries', [old, row]);
  assert.equal(kept.ok, true, kept.problems.join('; '));
  assert.equal(kept.rows[0].bld_litter_id, '');
  assert.equal(kept.rows[0].bld_subject_id, '');
  const withIds = full.slice();
  const valued = withIds.map((c) => (c === 'bld_litter_id' ? 'lit-001' : c === 'bld_subject_id' ? 'sub-01' : (row[old.indexOf(c)] || '')));
  const newer = C.parseTab('Enquiries', [withIds, valued]);
  assert.equal(newer.ok, true, newer.problems.join('; '));
  assert.equal(newer.rows[0].bld_litter_id, 'lit-001');
  assert.equal(newer.rows[0].bld_subject_id, 'sub-01');
  const moved = old.slice();
  const a = moved.indexOf('stage'), b = moved.indexOf('channel');
  [moved[a], moved[b]] = [moved[b], moved[a]];
  const bad = C.parseTab('Enquiries', [moved, row]);
  assert.equal(bad.ok, false);
  assert.equal(bad.rows.length, 0);
  assert.match(bad.problems.join(' '), /has moved/);
  const renamed = old.slice();
  renamed[renamed.indexOf('stage')] = 'step';
  assert.equal(C.parseTab('Enquiries', [renamed, row]).ok, false);
});

test('row builders match the BLD headers and keep sale price for ownership only', () => {
  const person = C.bldPersonRow({ name: 'Sample Buyer A', email: 'buyer.a@example.test', phone_e164: '+447700900000' }, { id: 'per-1', tenant_id: 'ten-1' });
  assert.deepEqual(Object.keys(person), C.BLD_COLUMNS.person);
  assert.equal(person.full_name, 'Sample Buyer A');
  assert.equal(person.id, 'per-1');
  assert.equal(JSON.stringify(person).includes('example.test'), false);
  assert.equal(JSON.stringify(person).includes('7700'), false);
  const home = C.bldHouseholdRow({ id: 'hhd-1', name: 'Sample Home A', primary_person_id: 'per-1', stage: 'deposit' });
  assert.deepEqual(Object.keys(home), C.BLD_COLUMNS.household);
  assert.equal(home.stage, 'deposit');
  assert.equal(C.bldHouseholdRow({ stage: 'lost' }), null);
  assert.equal(C.bldHouseholdRow({ stage: 'balance' }).stage, 'working to collection');
  const member = C.bldHouseholdMemberRow({ household_id: 'hhd-1', person_id: 'per-1' });
  assert.deepEqual(Object.keys(member), C.BLD_COLUMNS.household_member);
  const assigned = C.bldSubjectOwnerRow({ subject_id: 'sub-01', person_id: 'per-1', household_id: 'hhd-1', role: 'assigned' });
  assert.equal(assigned.role, 'assigned');
  assert.deepEqual(Object.keys(assigned), C.BLD_COLUMNS.subject_owner);
  const owner = C.bldSubjectOwnerRow({ subject_id: 'sub-01', stage: 'collected', person_id: 'per-1' });
  assert.equal(owner.role, 'owner');
  assert.equal(C.bldSubjectOwnerRow({ role: 'assigned' }), null);
  const early = C.bldSaleRow({ subject_id: 'sub-01', person_id: 'per-1', household_id: 'hhd-1', deposit: '500', deposit_date: '2026-03-01', sold_on: '2026-04-01', price: '2000', stage: 'deposit' });
  assert.deepEqual(Object.keys(early), C.BLD_COLUMNS.sale);
  assert.equal(early.deposit, '500');
  assert.equal(early.deposit_date, '2026-03-01');
  assert.equal(early.sold_on, '');
  assert.equal(early.price, '');
  const sold = C.bldSaleRow({ subject_id: 'sub-01', role: 'owner', deposit: '500', deposit_date: '2026-03-01', sold_on: '2026-04-01', price: '2000' });
  assert.equal(sold.sold_on, '2026-04-01');
  assert.equal(sold.price, '2000');
  assert.equal(sold.deposit, '500');
});
