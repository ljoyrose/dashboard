// Calendly capture (JOB 13 Stage 3). Run: node --test tests/enquiries/calendly.test.js
// Invented Calendly JSON only (tests/fixtures/enquiries/calendly.json).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');
const FX = require('../fixtures/enquiries/calendly.json');

const run = () => C.calendlyRecords(JSON.parse(JSON.stringify(FX.pairs)), { eventName: 'Whatsapp Call' });

test('a booking, a reschedule and a cancellation of the same invitee give ONE Enquiries row and THREE Events rows', () => {
  const out = run();
  const a = out.enquiries.filter((e) => e.source_ref === 'INV-SAMPLE-1');
  assert.equal(a.length, 1);
  const ev = out.events.filter((e) => e.enquiry_key === a[0].key);
  assert.deepEqual(ev.map((e) => e.type), ['booked', 'rescheduled', 'cancelled']);
  assert.equal(new Set(ev.map((e) => e.event_key)).size, 3);
  assert.equal(a[0].stage, 'new');
  assert.equal(a[0].next_step, 'Call cancelled: offer a new time');
  assert.equal(a[0].next_due_uk, '');
  assert.match(ev[2].detail, /cancelled by invitee/);
});

test('country basis is "inferred" when it came from the phone code', () => {
  const out = run();
  const a = out.enquiries.find((e) => e.source_ref === 'INV-SAMPLE-1');
  assert.equal(a.country, 'Switzerland');
  assert.equal(a.country_basis, 'inferred');
  const b = out.enquiries.find((e) => e.source_ref === 'INV-SAMPLE-3');
  assert.equal(b.country, 'United Kingdom'); assert.equal(b.country_basis, 'inferred');
});

test('only the Whatsapp Call event type is read; the row key is stable on a re-read', () => {
  const out = run();
  assert.equal(out.enquiries.length, 3);
  assert.ok(!out.enquiries.some((e) => e.source_ref === 'INV-SAMPLE-5'));
  assert.deepEqual(run().enquiries.map((e) => e.key), out.enquiries.map((e) => e.key));
  assert.equal(out.enquiries[0].key, C.rowKey('calendly', FX.pairs[0].invitee.uri));
  assert.deepEqual(run().events.map((e) => e.event_key), out.events.map((e) => e.event_key));
});

test('an active booking is call-booked with the call time due, in UK time', () => {
  const b = run().enquiries.find((e) => e.source_ref === 'INV-SAMPLE-3');
  assert.equal(b.stage, 'call-booked');
  assert.equal(b.next_due_uk, '2026-10-31T15:00:00');      // 31 Oct is GMT
  assert.equal(b.received_uk, '2026-10-29T12:00:00');
  assert.equal(b.kind, 'puppy');                            // "Puppies" on the puppy call
  assert.equal(b.question_summary, 'Puppies');
});

test('a no-show is an event and a flag; a phone/time-zone disagreement is flagged for a check', () => {
  const out = run();
  const c = out.enquiries.find((e) => e.source_ref === 'INV-SAMPLE-4');
  assert.equal(c.kind, 'stud');
  assert.equal(c.country, 'France'); assert.equal(c.country_basis, 'inferred');
  assert.match(c.flag, /country-check/); assert.match(c.flag, /no-show/);
  assert.deepEqual(out.events.filter((e) => e.enquiry_key === c.key).map((e) => e.type), ['booked', 'no-show']);
});

test('person details go only to the people list, normalised; summaries are capped at 300 characters', () => {
  const out = run();
  const p = out.people.find((x) => x.enquiry_key === out.enquiries.find((e) => e.source_ref === 'INV-SAMPLE-1').key);
  assert.equal(p.email, 'buyer.a@example.com');
  assert.equal(p.phone_e164, '+41790000001');
  for (const e of out.enquiries) { assert.ok(!('email' in e)); assert.ok(!('name' in e)); }
  const long = JSON.parse(JSON.stringify(FX.pairs[2]));
  long.invitee.questions_and_answers[1].answer = 'puppy '.repeat(100);
  assert.ok(C.calendlyRecords([long]).enquiries[0].question_summary.length <= 300);
});

test('every Calendly row passes the data contract', () => {
  for (const e of run().enquiries) {
    const row = Object.assign({}, e);
    assert.deepEqual(C.validateRow(row), [], e.source_ref);
  }
});

test('UK time follows the clocks (BST in summer, GMT in winter)', () => {
  assert.equal(C.toUk('2026-07-01T12:00:00Z'), '2026-07-01T13:00:00');
  assert.equal(C.toUk('2026-11-01T12:00:00Z'), '2026-11-01T12:00:00');
  assert.equal(C.toUk('nonsense'), '');
});
