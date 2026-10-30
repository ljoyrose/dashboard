// Stage 6: one person across sources, history, past deposits and the do-not-contact gate.
// Run: node --test tests/enquiries/people.test.js
// Every person here is invented: "Buyer A" style names, example.com addresses and Ofcom fiction numbers (07700 900xxx).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');

const inc = (o) => Object.assign({ channel: 'calendly', received_uk: '2026-10-01T10:00:00' }, o);

test('ACCEPT: same first name, different phones: never one person', () => {
  const r = C.resolvePeople([], [
    inc({ enquiry_key: 'K-1', name: 'Alex', phone_e164: '+447700900301' }),
    inc({ enquiry_key: 'K-2', name: 'Alex', phone_e164: '+447700900302' }),
    inc({ enquiry_key: 'K-3', name: 'Alex Sample', phone_e164: '+447700900303' }),
    inc({ enquiry_key: 'K-4', name: 'Alex Sample', phone_e164: '+447700900304' }),
    inc({ enquiry_key: 'K-5', name: 'Alex Example', email: 'alex.e@example.com' })
  ]);
  const keys = new Set(Object.values(r.assign));
  assert.equal(keys.size, 5, 'five different people');
  assert.equal(r.people.length, 5);
});

test('same email or same phone across sources is one person at confidence 1', () => {
  const r = C.resolvePeople([], [
    inc({ enquiry_key: 'K-1', channel: 'calendly', name: 'Buyer A', phone_e164: '+447700900311', received_uk: '2026-09-01T09:00:00' }),
    inc({ enquiry_key: 'K-2', channel: 'cf-website-optin', name: 'Buyer A', email: 'Buyer.A@example.com', phone: '07700 900311', received_uk: '2026-08-01T09:00:00' }),
    inc({ enquiry_key: 'K-3', channel: 'hubspot', email: 'buyer.a@example.com', received_uk: '2026-10-01T09:00:00' })
  ]);
  assert.equal(new Set(Object.values(r.assign)).size, 1);
  const p = r.people[0];
  assert.equal(p.match_confidence, 1);
  assert.equal(p.check, '');
  assert.equal(p.sources, 'calendly, cf-website-optin, hubspot');
  assert.equal(p.first_contact_uk, '2026-08-01T09:00:00');
  assert.equal(p.email, 'buyer.a@example.com');
  assert.equal(p.phone_e164, '+447700900311');
  assert.match(p.ref, /^C-\d{4}$/);
});

test('full-name match with no clash joins with a confidence below 0.9 and a check flag', () => {
  const r = C.resolvePeople([], [
    inc({ enquiry_key: 'K-1', name: 'Buyer Sampleton', phone_e164: '+447700900321' }),
    inc({ enquiry_key: 'K-2', channel: 'email', name: 'Mrs Buyer Sampleton', email: 'b.s@example.com' })
  ]);
  assert.equal(new Set(Object.values(r.assign)).size, 1);
  const p = r.people[0];
  assert.ok(p.match_confidence < 0.9 && p.match_confidence > 0.8, String(p.match_confidence));
  assert.match(p.check, /name match/);
});

test('similar but not alike enough names stay apart; a name clash on email stays apart', () => {
  const a = C.resolvePeople([], [inc({ enquiry_key: 'K-1', name: 'Buyer Sampleton', email: 'x1@example.com' }), inc({ enquiry_key: 'K-2', name: 'Buyer Exampleford', phone_e164: '+447700900331' })]);
  assert.equal(new Set(Object.values(a.assign)).size, 2);
  const b = C.resolvePeople([], [inc({ enquiry_key: 'K-1', name: 'Buyer Sampleton', email: 'x1@example.com' }), inc({ enquiry_key: 'K-2', name: 'Buyer Sampleton', email: 'x2@example.com' })]);
  assert.equal(new Set(Object.values(b.assign)).size, 2);
});

test('name similarity: titles, accents and initials', () => {
  assert.equal(C.nameKey("Mrs. Zoë O'Sample"), 'zoe osample');
  assert.equal(C.nameSimilarity('Zoe Osample', 'zoë o’sample'), 1);
  assert.equal(C.nameSimilarity('J Sample', 'Jo Sample'), 0.94);
  assert.ok(C.nameSimilarity('Alex', 'Alex') <= 0.7, 'a first name alone never reaches the bar');
  assert.equal(C.nameSimilarity('', 'Alex Sample'), 0);
});

test('a stored person keeps their key; a later record joins it; nothing is re-keyed', () => {
  const first = C.resolvePeople([], [inc({ enquiry_key: 'K-1', name: 'Buyer B', email: 'buyer.b@example.com' })]);
  const stored = first.people.map((p, i) => Object.assign({ _row: i + 2 }, p));
  const again = C.resolvePeople(stored, [inc({ enquiry_key: 'K-9', channel: 'calendly', email: 'BUYER.B@example.com', phone_e164: '+447700900341', received_uk: '2026-10-20T08:00:00' })]);
  assert.equal(again.assign['K-9'], stored[0].person_key);
  assert.equal(again.people.length, 1);
  assert.equal(again.people[0].phone_e164, '+447700900341');
  assert.equal(again.people[0].ref, stored[0].ref);
  assert.ok(!('_row' in again.people[0]));
});

test('one record bridging two stored people: both kept, the later one marked "same as ...?"', () => {
  const stored = C.resolvePeople([], [
    inc({ enquiry_key: 'K-1', email: 'buyer.c@example.com', received_uk: '2026-06-01T08:00:00' }),
    inc({ enquiry_key: 'K-2', phone_e164: '+447700900351', received_uk: '2026-07-01T08:00:00' })
  ]).people;
  const r = C.resolvePeople(stored, [inc({ enquiry_key: 'K-3', email: 'buyer.c@example.com', phone_e164: '+447700900351' })]);
  assert.equal(r.assign['K-3'], stored[0].person_key);
  const later = r.people.find((p) => p.person_key === stored[1].person_key);
  assert.match(later.check, new RegExp('same as ' + stored[0].person_key));
  assert.ok(later.match_confidence < 0.9);
});

test('do-not-contact is sticky: it never switches itself off', () => {
  const m = C.mergePerson({ consent: 'do-not-contact', do_not_contact: true }, { consent: 'ok', do_not_contact: false });
  assert.equal(m.consent, 'do-not-contact');
  assert.equal(m.do_not_contact, true);
  const u = C.mergePerson({ consent: 'ok' }, { consent: 'unsubscribed' });
  assert.equal(u.do_not_contact, true);
  const r = C.resolvePeople([], [inc({ enquiry_key: 'K-1', email: 'buyer.d@example.com', consent: 'do-not-contact' }), inc({ enquiry_key: 'K-2', email: 'buyer.d@example.com', consent: 'ok' })]);
  assert.equal(r.people[0].consent, 'do-not-contact');
});

test('ACCEPT: a do-not-contact person never gets a FollowUps row', () => {
  const people = { 'P-1': { person_key: 'P-1', consent: 'do-not-contact', do_not_contact: true }, 'P-2': { person_key: 'P-2', consent: 'ok' }, 'P-3': { person_key: 'P-3', consent: 'unsubscribed' } };
  const enq = { 'K-4': { key: 'K-4', do_not_contact: 'TRUE' } };
  const items = [
    { followup_key: 'F-1', enquiry_key: 'K-1', person_key: 'P-1' }, { followup_key: 'F-2', enquiry_key: 'K-2', person_key: 'P-2' },
    { followup_key: 'F-3', enquiry_key: 'K-3', person_key: 'P-3' }, { followup_key: 'F-4', enquiry_key: 'K-4', person_key: 'P-9' }
  ];
  const g = C.gateContact(items, people, enq);
  assert.deepEqual(g.keep.map((i) => i.followup_key), ['F-2']);
  assert.deepEqual(g.blocked.map((b) => b.why), ['do-not-contact', 'unsubscribed', 'do-not-contact']);
});

test('history: touches, first and last per person from Events', () => {
  const h = C.personHistory([
    { enquiry_key: 'K-1', at_uk: '2026-09-01T10:00:00' }, { enquiry_key: 'K-1', at_uk: '2026-09-03T10:00:00' },
    { enquiry_key: 'K-2', person_key: 'P-1', at_uk: '2026-08-15T10:00:00' }, { enquiry_key: 'K-3', at_uk: '2026-08-01T10:00:00' }
  ], { 'K-1': 'P-1', 'K-2': 'P-1' });
  assert.deepEqual(h['P-1'], { touches: 3, first_uk: '2026-08-15T10:00:00', last_uk: '2026-09-03T10:00:00' });
  assert.equal(h['P-x'], undefined);
});

test('past deposits: matched on hashed keys only; a sale makes a repeat buyer; name-only sets check', () => {
  const keys = C.depositKeys([
    { name: 'Buyer E Sample', email: 'buyer.e@example.com', status: 'collected' },
    { name: 'Buyer F Sample', whatsapp: '07700 900361', status: 'deposit paid' },
    { name: 'Buyer G Sample', outcome: 'refunded' }
  ]);
  const flat = JSON.stringify(keys);
  assert.ok(!/example|7700|Sample/i.test(flat), 'only hashes are kept');
  assert.ok(Object.keys(keys).every((k) => /^(em|ph|nm):[0-9a-f]{16}$/.test(k)));
  assert.deepEqual(C.depositFlags({ email: 'buyer.e@example.com' }, keys), { past_deposit: true, repeat_buyer: true, check: '' });
  assert.deepEqual(C.depositFlags({ phone_e164: '+447700900361' }, keys), { past_deposit: true, repeat_buyer: false, check: '' });
  assert.deepEqual(C.depositFlags({ name: 'buyer g sample' }, keys), { past_deposit: true, repeat_buyer: false, check: 'deposit list match on name only' });
  assert.deepEqual(C.depositFlags({ name: 'Buyer H Sample', email: 'buyer.h@example.com' }, keys), { past_deposit: false, repeat_buyer: false, check: '' });
});

test('allocation tabs: both header shapes read; leads with no deposit are not past deposits', () => {
  const current = [['section', 'ref', 'name', 'status', 'deposit_date', 'whatsapp', 'email', 'ppf (colour/gender)', 'notes', 'provisional_pup'],
    ['PUPS', 'r1', 'Buyer J Sample', 'deposit paid', '2026-09-10', '07700 900371', 'buyer.j@example.com', '', '', ''],
    ['LDB-WAITING', 'r2', 'Buyer K Sample', 'lead', '', '07700 900372', '', '', '', '']];
  const old = [['xero_contact', 'xero_contact_id', 'first_deposit', 'deposit_total', 'old_22oct_stage', 'outcome_27oct', 'evidence', 'now_on_CURRENT_tab'],
    ['Buyer L Sample', 'X-1', '2025-03-01', '500', 'collected', 'went home', '', 'no']];
  const rows = C.depositRowsFrom(current).concat(C.depositRowsFrom(old));
  assert.equal(rows[0].phone, '07700 900371');
  assert.equal(rows[2].name, 'Buyer L Sample');
  const keys = C.depositKeys(rows);
  assert.equal(C.depositFlags({ phone_e164: '+447700900371' }, keys).past_deposit, true);
  assert.equal(C.depositFlags({ phone_e164: '+447700900372' }, keys).past_deposit, false, 'a lead with no deposit');
  assert.deepEqual(C.depositFlags({ name: 'Buyer L Sample' }, keys), { past_deposit: true, repeat_buyer: true, check: 'deposit list match on name only' });
});
