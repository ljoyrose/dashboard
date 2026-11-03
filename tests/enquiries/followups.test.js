// Stage 12: follow-ups. Run: node --test tests/enquiries/followups.test.js
// Invented enquiry keys only. Nobody is messaged: rows and drafts wait for Lisa, who sends and taps done.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');

const RULES = C.followUpRules('first-reply=2, after-call=1, offer=3, waiting-list=30, lost-after=3');
const QUIET = '21:00-08:00';
const K = (n) => 'K-' + String(n).padStart(16, '0');
const enq = (n, stage, extra) => Object.assign({ key: K(n), person_key: 'P-' + n, stage, received_uk: '2026-10-20T10:00:00' }, extra);
const ev = (n, type, at) => ({ enquiry_key: K(n), type, at_uk: at });
const plan = (e, v, f, now) => C.planFollowUps(e, v, f, { now, rules: RULES, quiet: QUIET });

test('rules: Settings text read, unknown names ignored, defaults kept', () => {
  assert.deepEqual(RULES, { 'first-reply': 2, 'after-call': 1, offer: 3, 'waiting-list': 30, 'lost-after': 3 });
  assert.deepEqual(C.followUpRules('first-reply=4; bogus=9, offer = 5'), { 'first-reply': 4, 'after-call': 1, offer: 5, 'waiting-list': 30, 'lost-after': 3 });
  assert.equal(C.followUpCase('after-call'), 'call-check-in');
  assert.equal(C.followUpCase('nope'), '');
});

test('ACCEPT: an invented enquiry replied on Monday is due Wednesday', () => {
  const e = [enq(1, 'replied')], v = [ev(1, 'replied', '2026-11-02T10:00:00')]; // Monday 2 Nov 2026, UK clock
  const tue = plan(e, v, [], '2026-11-03T12:00:00Z');
  assert.equal(tue.length, 1);
  assert.deepEqual([tue[0].rule, tue[0].try, tue[0].status, tue[0].due_uk], ['first-reply', 1, 'waiting', '2026-11-04T10:00:00']);
  assert.equal(new Date('2026-11-04T10:00:00Z').getUTCDay(), 3, 'Wednesday');
  assert.equal(plan(e, v, [], '2026-11-04T10:30:00Z')[0].status, 'due');
});

test('quiet hours: a due time inside 21:00-08:00 UK moves to 08:00, also across BST', () => {
  const late = plan([enq(2, 'replied')], [ev(2, 'replied', '2026-11-02T22:30:00')], [], '2026-11-02T23:00:00Z')[0];
  assert.equal(late.due_uk, '2026-11-05T08:00:00', 'after 21:00: next morning');
  const early = plan([enq(3, 'call-held')], [ev(3, 'call-held', '2026-07-06T06:15:00')], [], '2026-07-06T06:00:00Z')[0];
  assert.equal(early.due_uk, '2026-07-07T08:00:00', 'before 08:00 (BST): same morning at 08:00');
  assert.equal(C.toUk(C.outOfQuiet(C.toMs('2026-11-02T15:00:00'), QUIET)), '2026-11-02T15:00:00', 'daytime unchanged');
});

test('ACCEPT: a lost one gets no further drafts: its open row is closed and no new row is made', () => {
  const first = plan([enq(4, 'offered')], [ev(4, 'offered', '2026-10-01T10:00:00')], [], '2026-10-10T12:00:00Z');
  assert.equal(first[0].status, 'due');
  const after = plan([enq(4, 'lost')], [], first, '2026-10-11T12:00:00Z');
  assert.deepEqual(after.map((f) => [f.followup_key, f.status]), [[first[0].followup_key, 'closed']]);
  assert.ok(!after.some((f) => f.status === 'due'), 'nothing due, so no draft');
  assert.deepEqual(plan([enq(4, 'lost')], [], after.map((f) => Object.assign({}, f)), '2026-10-12T12:00:00Z').filter((f) => f.status !== 'closed'), []);
});

test('ACCEPT: snooze moves the due date', () => {
  const e = [enq(5, 'replied')], v = [ev(5, 'replied', '2026-11-02T10:00:00')];
  const due = plan(e, v, [], '2026-11-05T09:00:00Z')[0];
  assert.equal(due.status, 'due');
  const snoozed = Object.assign({}, due, { status: 'snoozed', snoozed_to_uk: '2026-11-09T09:30:00' });
  const p = plan(e, v, [snoozed], '2026-11-05T09:05:00Z')[0];
  assert.deepEqual([p.followup_key, p.status, p.due_uk], [due.followup_key, 'snoozed', '2026-11-09T09:30:00']);
  assert.equal(plan(e, v, [snoozed], '2026-11-09T09:31:00Z')[0].status, 'due', 'due again once the snooze ends');
  const r = C.snoozeRequest(due.followup_key, '2026-11-09T09:30:00', '2026-11-05T09:05:00.000Z');
  assert.ok(r.ok); assert.equal(r.body.until_uk, '2026-11-09T09:30:00');
  assert.equal(C.snoozeRequest(due.followup_key, '2026-11-01T09:00:00', '2026-11-05T09:05:00.000Z').ok, false, 'a time in the past is refused');
});

test('done: the next try counts from Lisa\'s tap; after 3 tries the hub suggests lost; the waiting list repeats', () => {
  const e = [enq(6, 'replied')], v = [ev(6, 'replied', '2026-10-01T10:00:00')];
  let rows = [];
  for (let n = 1; n <= 3; n++) {
    const p = plan(e, v, rows, '2026-12-31T12:00:00Z').find((f) => f.status === 'due');
    assert.equal(p.try, n);
    rows = rows.concat([Object.assign({}, p, { status: 'done', updated_uk: '2026-10-' + (10 * n) + 'T10:00:00' })]);
  }
  const last = plan(e, v, rows, '2026-12-31T12:00:00Z');
  assert.deepEqual(last.map((f) => [f.try, f.status]), [[4, 'suggest-lost']]);
  const two = plan(e, v, rows.slice(0, 1), '2026-10-11T12:00:00Z')[0];
  assert.deepEqual([two.try, two.due_uk, two.status], [2, '2026-10-12T10:00:00', 'waiting']);
  const wl = [enq(7, 'deposit')], wv = [ev(7, 'deposit-paid', '2026-08-01T10:00:00')];
  let w = [];
  for (let n = 1; n <= 4; n++) w.push(Object.assign({}, plan(wl, wv, w, '2027-06-01T12:00:00Z')[0], { status: 'done', updated_uk: '2026-09-01T10:00:00' }));
  assert.equal(plan(wl, wv, w, '2027-06-01T12:00:00Z')[0].status, 'due', 'never suggest-lost on the waiting list');
});

test('stage moves on: the old rule closes and the new rule opens; new and call-booked have no follow-up', () => {
  const r1 = plan([enq(8, 'replied')], [ev(8, 'replied', '2026-10-01T10:00:00')], [], '2026-10-02T12:00:00Z');
  const r2 = plan([enq(8, 'call-held')], [ev(8, 'replied', '2026-10-01T10:00:00'), ev(8, 'call-held', '2026-10-02T15:00:00')], r1, '2026-10-02T16:00:00Z');
  assert.deepEqual(r2.map((f) => [f.rule, f.status]), [['first-reply', 'closed'], ['after-call', 'waiting']]);
  assert.deepEqual(plan([enq(9, 'new'), enq(10, 'call-booked')], [], [], '2026-10-02T12:00:00Z'), []);
});

test('follow-up drafts: every case builds, passes the draft check and names no price', () => {
  for (const rule of ['first-reply', 'after-call', 'offer', 'waiting-list']) {
    const d = C.buildDraft(C.followUpCase(rule), { name: 'Buyer Sample', prefs: { size: 'medium' } });
    assert.ok(d, rule);
    assert.deepEqual(C.checkDraft(d.email.text), [], rule + ' email');
    assert.deepEqual(C.checkDraft(d.whatsapp), [], rule + ' whatsapp');
  }
});

test('requests: replied and done carry keys only; unknown keys refused', () => {
  const r = C.repliedRequest(K(1), '2026-11-02T10:00:00.000Z');
  assert.deepEqual(Object.keys(r.body).sort(), ['at', 'enquiry_key', 'kind', 'v']);
  const d = C.doneRequest('F-00000000000000ab', true, '2026-11-02T10:00:00.000Z');
  assert.equal(d.body.lost, true); assert.equal(d.body.kind, 'done');
  assert.equal(C.doneRequest('F-00000000000000ab').body.lost, false);
  assert.equal(C.repliedRequest('x').ok, false);
  assert.equal(C.doneRequest('x').ok, false);
  assert.equal(C.snoozeRequest('x', '2027-01-01T10:00:00').ok, false);
});
