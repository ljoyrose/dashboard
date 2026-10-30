// Stage 10: waiting list, litters and the adult-dog sale. Run: node --test tests/enquiries/litters.test.js
// Invented litter and sale sheet only (tests/fixtures/enquiries/litter.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');
const F = require('../fixtures/enquiries/litter.js');

const NOW = '2026-11-02T12:00:00Z';
const rowsWithOffer = () => {
  const rows = C.litterRowsFrom(F.current, { source: 'ALLOC-SAMPLE' });
  rows.find((r) => r.pup_ref === 'xx26-03' && r.list === 'pups').status_since_uk = '2026-10-28T12:00:00'; // offered 5 days ago
  return rows;
};
const pk = (n) => 'P-' + C.hash(C.emailKey(n + '@example.com'));

test('mirror: 7 pups (2 open), 8 deposit holders, the waiting list; only hashed person keys, no names or numbers', () => {
  const rows = C.litterRowsFrom(F.current, { source: 'ALLOC-SAMPLE' });
  const pups = rows.filter((r) => r.list === 'pups');
  assert.equal(pups.length, 7);
  assert.equal(pups.filter((p) => p.status === 'open').length, 2);
  assert.equal(rows.filter((r) => r.list === 'litter-a' && r.deposit_date).length, 8);
  assert.equal(rows.filter((r) => r.list === 'waiting').length, 3);
  assert.ok(rows.every((r) => r.litter_ref === 'xx26'));
  assert.deepEqual(pups[0], Object.assign({}, pups[0], { sex: 'female', colour: 'chocolate', size: 'medium', coat: 'fleece' }));
  assert.doesNotMatch(JSON.stringify(rows), /Buyer|example\.com|7700/, 'no name, email or number from the sheet');
  assert.equal(rows.find((r) => r.list_order === 2 && r.list === 'waiting').person_key, pk('d2'), 'the same person keyed the same way on both lists');
  assert.equal(new Set(rows.map((r) => r.litter_key)).size, rows.length);
});

test('ACCEPT: matches waiting people to the 2 open pups: deposit holders first, then the waiting list, in order', () => {
  const m = C.matchLitter(C.litterRowsFrom(F.current, { source: 'ALLOC-SAMPLE' }));
  assert.deepEqual(m.map((x) => [x.pup_ref, x.person_key, x.list]), [
    ['xx26-01', pk('d1'), 'litter-a'], ['xx26-01', pk('d3'), 'litter-a'], ['xx26-01', pk('w1'), 'waiting'],
    ['xx26-02', pk('d2'), 'litter-a']
  ]);
  assert.ok(!m.some((x) => x.person_key === pk('c1')), 'the closed list is never matched');
});

test('ACCEPT: flags: open pup with no offer, offered over 3 days, deposit holder with no pup, person on two lists', () => {
  const f = C.litterFlags(rowsWithOffer(), NOW, 3).map((x) => [x.flag, x.pup_ref || x.person_key]);
  assert.deepEqual(f.filter((x) => x[0] === 'open pup, no offer').map((x) => x[1]), ['xx26-01', 'xx26-02']);
  assert.deepEqual(f.filter((x) => /^offered more than 3 days/.test(x[0])).map((x) => x[1]), ['xx26-03']);
  assert.deepEqual(f.filter((x) => x[0] === 'deposit holder with no pup').map((x) => x[1]), [pk('d1'), pk('d2'), pk('d3')]);
  assert.deepEqual(f.filter((x) => /two lists/.test(x[0])).map((x) => x[1]), [pk('d2'), pk('d2')]);
  assert.equal(C.litterFlags(rowsWithOffer(), '2026-10-30T12:00:00Z', 3).filter((x) => /^offered/.test(x.flag)).length, 0, 'only 2 days: no flag yet');
});

test('sale sheet: only group, name and Status are read; Price and COI never are', () => {
  const dogs = C.saleDogsFrom(F.sale);
  assert.equal(dogs.length, 5);
  assert.deepEqual(Object.keys(dogs[0]).sort(), ['dog_ref', 'group_ref', 'sale_status']);
  assert.doesNotMatch(JSON.stringify(dogs), /9999|8888|7777|%/);
});

test('ACCEPT: sale group cards show replies, viewings and agreed counts, "price on request" only, no price or COI', () => {
  const dogs = C.saleDogsFrom(F.sale);
  const enq = [
    { key: 'K-a', person_key: 'P-a', kind: 'breeding-set', stage: 'asked', question_summary: 'Is group 1 still available?', received_uk: '2026-10-27T10:00:00' },
    { key: 'K-b', person_key: 'P-b', kind: 'adult-dog', stage: 'viewing', question_summary: 'Could we come and see Dog Charlie?', received_uk: '2026-10-28T10:00:00' },
    { key: 'K-c', person_key: 'P-c', kind: 'adult-dog', stage: 'agreed', question_summary: 'We would love Dog Foxtrot', received_uk: '2026-10-29T10:00:00' },
    { key: 'K-d', person_key: 'P-d', kind: 'adult-dog', stage: 'asked', question_summary: 'Tell me about Dog Delta please', received_uk: '2026-10-29T11:00:00' },
    { key: 'K-e', person_key: 'P-e', kind: 'puppy', stage: 'new', question_summary: 'A puppy like Dog Alpha?' }
  ];
  const replies = C.saleReplyRows(enq, dogs);
  assert.ok(!replies.some((r) => r.enquiry_key === 'K-e'), 'puppy enquiries are not sale replies');
  const cards = C.saleGroupCards(dogs, replies);
  const g1 = cards.find((c) => c.group_ref === '1'), g2 = cards.find((c) => c.group_ref === '2'), single = cards.find((c) => /Individual/.test(c.group_ref));
  assert.deepEqual([g1.replies, g1.viewings, g1.agreed], [2, 1, 0]);
  assert.deepEqual([g2.replies, single.agreed], [1, 1]);
  assert.equal(g1.dogs.find((d) => d.dog_ref === 'Dog Charlie').sale_status, 'Viewing booked');
  for (const c of cards) {
    assert.equal(c.price, 'price on request');
    assert.deepEqual(C.checkCard(c), [], c.group_ref);
  }
  assert.deepEqual(C.checkCard(Object.assign({}, g1, { price: '9999' })), ['a price']);
  assert.deepEqual(C.checkCard(Object.assign({}, g1, { note: 'COI 5%' })), ['a COI value']);
});
