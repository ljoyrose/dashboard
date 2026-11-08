// Stage 15: alerts. Run: node --test tests/enquiries/alerts.test.js
// Invented rows only: E-00xx refs, P-xN people, L-T litters. "Now" is fixed so every hour count is worked out by hand.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');

const NOW = '2026-06-10T12:00:00';
const enq = (n, o) => Object.assign({ key: 'K-' + n, person_key: 'P-x' + n, ref: 'E-00' + n, channel: 'email', source: 'Website', kind: 'puppy',
  stage: 'new', band: 'warm', received_uk: '2026-06-10T09:00:00', consent: 'ok', do_not_contact: '', question_summary: 'A girl please', flag: '' }, o);
const person = (n, o) => Object.assign({ person_key: 'P-x' + n, ref: 'E-00' + n, consent: 'ok', do_not_contact: '' }, o);
const kinds = (list, kind) => list.filter((a) => a.kind === kind);
const refs = (list, kind) => kinds(list, kind).map((a) => a.ref || a.pup_ref || a.source);

test('version is 1.14.0 and the seven alert kinds are named', () => {
  assert.match(C.VERSION, /^enquiries-core 1\.14\.0 /);
  assert.deepEqual(C.ALERT_KINDS, ['hot-no-reply', 'blank-run', 'contact-blocked', 'call-no-prep', 'pup-no-offer', 'balance-overdue', 'source-silent']);
});

test('ACCEPT: a hot enquiry older than 24 h with no reply is listed', () => {
  const tabs = {
    Enquiries: [
      enq(11, { band: 'hot', received_uk: '2026-06-09T11:00:00' }), // 25 h, no reply: listed
      enq(12, { band: 'hot', received_uk: '2026-06-09T13:00:00' }), // 23 h: not yet
      enq(13, { band: 'hot', received_uk: '2026-06-08T12:00:00' }), // 48 h but a reply event: not listed
      enq(14, { band: 'warm', received_uk: '2026-06-08T12:00:00' }), // warm: not listed
      enq(15, { band: 'hot', received_uk: '2026-06-08T12:00:00', stage: 'lost' }), // closed: not listed
      enq(16, { band: 'hot', received_uk: '2026-06-08T12:00:00', flag: 'junk?' }), // junk: not listed
      enq(17, { band: 'hot', received_uk: '2026-06-09T12:00:00' }) // exactly 24 h: listed
    ],
    People: [11, 12, 13, 14, 15, 16, 17].map((n) => person(n)),
    Events: [{ event_key: 'V-1', enquiry_key: 'K-13', type: 'replied', at_uk: '2026-06-08T14:00:00' }]
  };
  const a = C.alertsView(tabs, { now: NOW });
  assert.deepEqual(refs(a, 'hot-no-reply'), ['E-0011', 'E-0017'], 'oldest first');
  assert.match(kinds(a, 'hot-no-reply')[0].text, /25 h/);
});

test('blank run: read nothing, never finished, or stale; a good run gives nothing', () => {
  const run = (at, counts, extra) => [{ at_uk: at, level: 'INFO', step: 'run', message: 'start, DRY_RUN=false' }]
    .concat(Object.keys(counts).map((s) => ({ at_uk: at, level: 'INFO', step: s, message: '0 enquiries', count: counts[s] })))
    .concat(extra || []).concat([{ at_uk: at, level: 'INFO', step: 'run', message: 'done in 12s' }]);
  const blank = (log) => kinds(C.alertsView({ Log: log }, { now: NOW }), 'blank-run');
  assert.equal(blank(run('2026-06-10T11:00:00', { calendly: 2, gmail: 0 })).length, 0);
  assert.match(blank(run('2026-06-10T11:00:00', { calendly: 0, gmail: '', hubspot: 0 }))[0].text, /read nothing/);
  const err = run('2026-06-10T11:00:00', { calendly: 0 }, [{ at_uk: '2026-06-10T11:00:00', level: 'ERROR', step: 'readGmail_', message: 'x' }]);
  assert.match(blank(err)[0].text, /1 errors/);
  assert.match(blank(run('2026-06-10T08:00:00', { calendly: 4 }))[0].text, /No engine run for 4 h/);
  assert.match(blank([{ at_uk: '2026-06-10T11:00:00', level: 'INFO', step: 'run', message: 'start' }])[0].text, /never finished/);
  // An older good run followed by a newer blank one: the newer one counts.
  assert.equal(blank(run('2026-06-10T09:00:00', { calendly: 3 }).concat(run('2026-06-10T11:00:00', { calendly: 0 }))).length, 1);
  assert.equal(blank([]).length, 0, 'no Log rows (engine not installed): no alert');
  assert.deepEqual(C.lastRun(run('2026-06-10T11:00:00', { calendly: 2, gmail: 3, score: 9 })), { start: '2026-06-10T11:00:00', done: '2026-06-10T11:00:00', read: 5, readers: 2, errors: 0 });
});

test('contact rule: a live enquiry that a rule blocks is listed with the reason', () => {
  const tabs = {
    Enquiries: [enq(21), enq(22, { do_not_contact: 'yes' }), enq(23, { stage: 'collected' }), enq(24)],
    People: [person(21, { consent: 'unsubscribed' }), person(22), person(23, { do_not_contact: 'yes' }), person(24)]
  };
  const a = kinds(C.alertsView(tabs, { now: NOW }), 'contact-blocked');
  assert.deepEqual(a.map((x) => x.ref), ['E-0021', 'E-0022']);
  assert.match(a[0].text, /unsubscribed/);
  assert.match(a[1].text, /do-not-contact/);
  assert.equal(kinds(C.alertsView(tabs, { now: NOW }), 'hot-no-reply').length, 0);
});

test('call in 2 h with no prep: no prep card, or a blank booking form', () => {
  const call = (n, at, o) => enq(n, Object.assign({ channel: 'calendly', stage: 'call-booked', next_due_uk: at }, o));
  const tabs = {
    Enquiries: [
      call(31, '2026-06-10T13:30:00', { question_summary: '' }), // 1.5 h, booking form blank: listed
      call(32, '2026-06-10T13:00:00'), // 1 h, prep card has the form: not listed
      call(33, '2026-06-10T13:00:00', { channel: 'email' }), // not a Calendly booking, so no prep card: listed
      call(34, '2026-06-10T15:00:00', { question_summary: '' }), // 3 h away: not yet
      call(35, '2026-06-10T11:00:00', { question_summary: '' }) // already started: not listed
    ],
    People: [31, 32, 33, 34, 35].map((n) => person(n))
  };
  assert.deepEqual(refs(C.alertsView(tabs, { now: NOW }), 'call-no-prep'), ['E-0033', 'E-0031']);
});

test('open pup with no offer: open more than 3 days and held by nobody', () => {
  const pup = (n, o) => Object.assign({ litter_key: 'L-p' + n, litter_ref: 'L-T', pup_ref: 'L-T-' + n, list: 'pups', status: 'open', status_since_uk: '2026-06-01' }, o);
  const tabs = {
    Litters: [
      pup(1), // open 9 days: listed
      pup(2, { status_since_uk: '2026-06-09' }), // open 1 day: not yet
      pup(3, { status_since_uk: '' }), // no date: listed
      pup(4, { status: 'reserved' }), // reserved: not listed
      pup(5), { litter_key: 'L-w5', litter_ref: 'L-T', pup_ref: 'L-T-5', list: 'deposit list', person_key: 'P-x5' } // held: not listed
    ]
  };
  assert.deepEqual(refs(C.alertsView(tabs, { now: NOW }), 'pup-no-offer').sort(), ['L-T-1', 'L-T-3']);
});

test('deposit balance overdue: collection passed with balance owed; no amount in the text', () => {
  const dep = (n, o) => Object.assign({ deposit_key: 'D-' + n, litter_ref: 'L-T', pup_ref: 'L-T-' + n, status: 'held', deposit: '500', balance_due: '1500',
    balance_paid: '', collection_date: '2026-06-01' }, o);
  const tabs = { Deposits: [dep(1), dep(2, { balance_paid: '1500' }), dep(3, { collection_date: '2026-06-20' }), dep(4, { status: 'collected' }),
    dep(5, { balance_due: '', balance_paid: '' }), dep(6, { collection_date: '' })] };
  const a = kinds(C.alertsView(tabs, { now: NOW }), 'balance-overdue');
  assert.deepEqual(a.map((x) => x.pup_ref).sort(), ['L-T-1', 'L-T-5']);
  for (const x of a) assert.doesNotMatch(x.text, /500|1500|£/, 'no amount');
});

test('source silent for 14 days; off and manual sources are left out', () => {
  const tabs = {
    Enquiries: [enq(41, { source: 'Calendly', channel: 'calendly', received_uk: '2026-06-05T10:00:00' }),
      enq(42, { source: 'ClickFunnels', channel: 'cf-waiting-list', received_uk: '2026-05-20T10:00:00' })],
    Sources: [{ source: 'calendly', status: 'live' }, { source: 'ClickFunnels', status: 'live' }, { source: 'HubSpot', status: 'live' },
      { source: 'Pets4Homes', status: 'manual' }, { source: 'Old form', status: 'retired' }]
  };
  const a = kinds(C.alertsView(tabs, { now: NOW }), 'source-silent');
  assert.deepEqual(a.map((x) => x.source), ['HubSpot', 'ClickFunnels']);
  assert.match(a[1].text, /21 days/);
  assert.match(a[0].text, /no enquiry yet/);
});

test('open-work rows: one per alert, refs only, never a name, email or number', () => {
  const tabs = { Enquiries: [enq(51, { band: 'hot', received_uk: '2026-06-08T12:00:00' })], People: [person(51, { name: 'Example51', email: 'b@example.test', phone_e164: '+447700900151' })] };
  const rows = C.openWorkRows(C.alertsView(tabs, { now: NOW }), NOW);
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]), ['key', 'area', 'item', 'next_step', 'owner', 'raised_uk', 'source']);
  assert.equal(rows[0].key, 'A-hot-no-reply-K-51');
  const flat = JSON.stringify(rows);
  assert.doesNotMatch(flat, /Example51|example\.test|7700/);
});

test('the example rows show four alert kinds', () => {
  const X = require('../../enquiries/examples.js');
  const a = C.alertsView(X.build(NOW), { now: NOW });
  const seen = [...new Set(a.map((x) => x.kind))];
  // The example hot rows are fresh (so the Stage 13 counts stand) and its one deposit is not due: those two kinds show only in real use.
  assert.deepEqual(seen, ['blank-run', 'contact-blocked', 'pup-no-offer', 'source-silent']);
  assert.deepEqual(a.filter((x) => x.kind === 'source-silent').map((x) => x.source), ['Pets4Homes']);
});
