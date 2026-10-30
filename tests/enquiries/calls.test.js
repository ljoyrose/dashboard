// Stage 9: call prep and after the call. Run: node --test tests/enquiries/calls.test.js
// Every person and pup here is invented. Times are UK clock time; "now" is fixed.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');
const Q = require('../../enquiries/requests.js');

const NOW = '2026-11-02T15:00:00Z'; // Monday, GMT
const PUPS = [
  { pup_ref: 'xx26-01', sex: 'female', colour: 'chocolate', size: 'medium', coat: 'fleece', status: 'open' },
  { pup_ref: 'xx26-02', sex: 'male', colour: 'cream', size: 'miniature', coat: 'wool', status: 'open' },
  { pup_ref: 'xx26-03', sex: 'female', colour: 'chocolate', size: 'medium', coat: 'fleece', status: 'sold' }
];
const CALL = { key: 'K-00000000000000c1', ref: 'E-0101', person_key: 'P-00000000000000c1', channel: 'calendly', stage: 'call-booked',
  next_due_uk: '2026-11-03T10:00:00', country: 'Switzerland', country_basis: 'inferred', kind: 'puppy',
  question_summary: 'We would love a chocolate girl in the spring' };
const EVENTS = [
  { enquiry_key: CALL.key, person_key: CALL.person_key, at_uk: '2026-10-28T09:00:00', channel: 'calendly', type: 'booked' },
  { enquiry_key: 'K-other', person_key: CALL.person_key, at_uk: '2026-09-01T09:00:00', channel: 'email', type: 'received' },
  { enquiry_key: 'K-else', person_key: 'P-someone-else', at_uk: '2026-10-01T09:00:00', channel: 'email', type: 'received' }
];

test('ACCEPT: an invented call tomorrow gives a prep card with the fitting invented pup', () => {
  const p = C.callPrep(CALL, { now: NOW, openPups: PUPS, events: EVENTS });
  assert.deepEqual(p.pups, ['xx26-01'], 'the open chocolate girl, not the sold one or the cream boy');
  assert.equal(p.ref, 'E-0101');
  assert.equal(p.country, 'Switzerland'); assert.equal(p.country_basis, 'inferred');
  assert.equal(p.their_time, 'Tue 11:00');
  assert.ok(p.reasons.length >= 1 && p.reasons.length <= 3);
  assert.ok(p.score > 0 && p.band);
  assert.equal(p.asked, CALL.question_summary);
  assert.deepEqual(p.touches, ['2026-10-28 · calendly · booked', '2026-09-01 · email · received'], 'every past touch of this person, newest first');
  assert.equal(p.questions.length, 2);
  assert.equal(p.ready, false, 'not ready the day before');
  assert.equal(p.ready_from_uk, '2026-11-03T08:00:00');
});

test('the prep card is ready from 2 hours before the call (UK clock, either side of the clocks changing)', () => {
  assert.equal(C.callPrep(CALL, { now: '2026-11-03T07:59:00Z', openPups: PUPS }).ready, false);
  assert.equal(C.callPrep(CALL, { now: '2026-11-03T08:00:00Z', openPups: PUPS }).ready, true);
  const summer = Object.assign({}, CALL, { next_due_uk: '2026-07-01T10:00:00' }); // BST: 10:00 UK is 09:00 UTC
  assert.equal(C.callPrep(summer, { now: '2026-07-01T06:59:00Z' }).ready, false);
  assert.equal(C.callPrep(summer, { now: '2026-07-01T07:00:00Z' }).ready, true);
  assert.equal(C.callPrep(CALL, { now: NOW, readyHours: 24 }).ready, true, 'prep_hours from Settings');
});

test('no card without a booked call; several-zone countries are not guessed', () => {
  assert.equal(C.callPrep(Object.assign({}, CALL, { channel: 'email' }), { now: NOW }), null);
  assert.equal(C.callPrep(Object.assign({}, CALL, { stage: 'call-held' }), { now: NOW }), null);
  assert.equal(C.callPrep(Object.assign({}, CALL, { next_due_uk: '' }), { now: NOW }), null);
  assert.equal(C.callPrep(Object.assign({}, CALL, { country: 'United States' }), { now: NOW }).their_time, 'their time: check');
});

test('questions: the gaps first, sensitive things asked kindly, never more than two', () => {
  const q = C.questionsToAsk({ question_summary: 'puppy please' }, {}, []);
  assert.deepEqual(q, ['When would you like your puppy to come home?', 'Girl or boy, and what size suits your home?']);
  const a = C.questionsToAsk({ question_summary: 'a boy asap, big garden' }, { sex: 'male' }, ['allergies']);
  assert.equal(a[0], 'Who in the family has allergies, and have they spent time with a low-shedding dog?');
  assert.equal(a.length, 2);
});

test('"call held" request: one small file per tap, only for a real enquiry key; example mode sends nothing', async () => {
  const r = C.callHeldRequest(CALL.key, '2026-11-03T10:15:00.000Z', 'went well');
  assert.equal(r.ok, true);
  assert.deepEqual(r.body, { v: 1, kind: 'call-held', enquiry_key: CALL.key, note: 'went well', at: '2026-11-03T10:15:00.000Z' });
  assert.match(r.name, /^ENQ-call-held-20261103101500-[0-9a-f]{6}\.json$/);
  assert.equal(C.callHeldRequest('nonsense').ok, false);
  assert.deepEqual(await Q.callHeld({}, CALL.key), { queued: false, example: true });
  const sent = [];
  const res = await Q.callHeld({ folderId: 'FOLDER-SAMPLE', token: 'test-token-not-real', fetch: (u, o) => { sent.push([u, o]); return Promise.resolve({ ok: true, json: () => ({ id: 'FILE-1' }) }); } }, CALL.key);
  assert.equal(res.queued, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0][1].body, /"kind":"call-held"/);
});
