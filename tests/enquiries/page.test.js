// Stage 13: the enquiries page's pure logic. Run: node --test tests/enquiries/page.test.js
// Invented rows only (enquiries/examples.js). Nothing is sent: taps are request files, the page keeps its own copy.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');
const X = require('../../enquiries/examples.js');

const NOW = '2026-11-03T12:00:00Z';
const fresh = () => X.build(NOW);

test('version is 1.12.0', () => assert.match(C.VERSION, /^enquiries-core 1\.12\.0 /));

test('ACCEPT: newest and hottest first: a hot row shows above a cool row, newest first within a band', () => {
  const rows = [
    { key: 'a', band: 'cool', received_uk: '2026-11-03T11:00:00' },
    { key: 'b', band: 'hot', received_uk: '2026-11-01T09:00:00' },
    { key: 'c', band: 'hot', received_uk: '2026-11-02T09:00:00' },
    { key: 'd', band: '', received_uk: '2026-11-03T11:30:00' },
    { key: 'e', band: 'warm', received_uk: '2026-11-03T08:00:00' }
  ];
  assert.deepEqual(C.sortEnquiries(rows).map((r) => r.key), ['c', 'b', 'e', 'a', 'd']);
  assert.equal(rows[0].key, 'a', 'input not changed');
});

test('ACCEPT: the counts match the fixture', () => {
  const v = C.hubView(fresh(), { now: NOW });
  assert.deepEqual(v.counts, { newToday: 3, hot: 2, calls48: 1, followupsDue: 1, openPups: 2 });
  assert.deepEqual(v.fresh.map((e) => e.ref), ['E-0004', 'E-0005', 'E-0002']);
  assert.deepEqual(v.hot.map((e) => e.ref), ['E-0004', 'E-0001']);
  assert.equal(v.deposits.all.held_count, 1);
  assert.equal(v.sale[0].price, 'price on request');
});

test('a do-not-contact follow-up is never counted or shown; its draft is never offered', () => {
  const t = fresh(), v = C.hubView(t, { now: NOW });
  assert.deepEqual(v.today.followups.map((f) => f.enquiry_key), [X.K(3)]);
  const d = C.enquiryDetail(t, X.K(5), { now: NOW });
  assert.equal(d.contact.ok, false);
  assert.equal(d.draft, null);
  assert.deepEqual(d.actions, []);
});

test('detail: score reasons, touches, the draft to copy and the actions that fit the stage', () => {
  const t = fresh(), d = C.enquiryDetail(t, X.K(1), { now: NOW });
  assert.equal(d.reasons.length, 3);
  assert.ok(d.touches.length >= 1);
  assert.deepEqual(d.actions, ['call-held']);
  assert.ok(d.prep && d.prep.ready === false);
  const d4 = C.enquiryDetail(t, X.K(4), { now: NOW });
  assert.match(d4.draft.text, /doc\.labradoodles\.co\.uk/);
  assert.deepEqual(d4.actions, ['replied']);
  assert.deepEqual(C.enquiryDetail(t, X.K(3), { now: NOW }).actions, ['snooze', 'done']);
  assert.equal(C.enquiryDetail(t, 'K-nope', {}), null);
});

test('a draft that breaks a hard rule is never offered to copy', () => {
  const t = fresh();
  t.Drafts.find((d) => d.enquiry_key === X.K(4)).text = 'Hi, the pup is £2,000. https://doc.labradoodles.co.uk/breed';
  assert.equal(C.enquiryDetail(t, X.K(4), { now: NOW }).draft, null);
});

test('Stage 9: an invented call tomorrow gets a prep card with the fitting invented pup only', () => {
  const v = C.hubView(fresh(), { now: NOW });
  assert.equal(v.today.calls.length, 1);
  assert.deepEqual(v.today.calls[0].pups, ['L-EX1-1']);
  assert.equal(v.today.calls[0].questions.length, 2);
});

test('Stage 9: "call held" moves the stage to call-held and makes exactly one after-call draft, even if tapped twice', () => {
  const t = fresh(), built = C.callHeldRequest(X.K(1), NOW);
  C.applyRequest(t, built, NOW);
  C.applyRequest(t, C.callHeldRequest(X.K(1), NOW), NOW);
  const e = t.Enquiries.find((x) => x.key === X.K(1));
  assert.equal(e.stage, 'call-held');
  const drafts = t.Drafts.filter((d) => d.enquiry_key === X.K(1));
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].case, 'after-call');
  assert.deepEqual(C.checkDraft(drafts[0].text), []);
  assert.equal(C.enquiryDetail(t, X.K(1), { now: NOW }).draft.case, 'after-call');
  assert.equal(C.hubView(t, { now: NOW }).counts.calls48, 0);
});

test('call held for a do-not-contact person moves the stage but makes no draft', () => {
  const t = fresh(), e = t.Enquiries.find((x) => x.key === X.K(5));
  e.stage = 'call-booked'; e.channel = 'calendly';
  C.applyRequest(t, C.callHeldRequest(X.K(5), NOW), NOW);
  assert.equal(e.stage, 'call-held');
  assert.equal(t.Drafts.filter((d) => d.enquiry_key === X.K(5) && d.case === 'after-call').length, 0);
});

test('the other taps: replied, deposit paid, snooze and done', () => {
  const t = fresh();
  C.applyRequest(t, C.repliedRequest(X.K(4), NOW), NOW);
  assert.equal(t.Enquiries.find((x) => x.key === X.K(4)).stage, 'replied');
  C.applyRequest(t, C.depositPaidRequest(X.K(3), '', NOW), NOW);
  assert.equal(t.Enquiries.find((x) => x.key === X.K(3)).stage, 'deposit');
  C.applyRequest(t, C.snoozeRequest(X.F(3), '2026-11-05T09:00', NOW), NOW);
  assert.equal(t.FollowUps.find((f) => f.followup_key === X.F(3)).status, 'snoozed');
  assert.equal(C.hubView(t, { now: NOW }).counts.followupsDue, 0);
  C.applyRequest(t, C.doneRequest(X.F(3), true, NOW), NOW);
  assert.equal(t.FollowUps.find((f) => f.followup_key === X.F(3)).status, 'done');
  assert.equal(t.Enquiries.find((x) => x.key === X.K(3)).stage, 'lost');
  assert.equal(C.applyRequest(t, { ok: false }), t, 'a refused request changes nothing');
});

test('filters live in the URL hash and round-trip', () => {
  const f = { band: 'hot', country: 'United Kingdom', source: 'Website' };
  const h = C.hashFor('list', f);
  assert.equal(h, '#/list?source=Website&band=hot&country=United%20Kingdom');
  assert.deepEqual(C.filtersFromHash(h), { view: 'list', key: '', f });
  assert.deepEqual(C.filtersFromHash('#/e/' + X.K(2)), { view: 'e', key: X.K(2), f: {} });
  assert.deepEqual(C.filtersFromHash('#/list?bogus=1&stage=new'), { view: 'list', key: '', f: { stage: 'new' } });
  assert.deepEqual(C.filtersFromHash(''), { view: 'home', key: '', f: {} });
  const rows = fresh().Enquiries;
  assert.deepEqual(C.filterEnquiries(rows, { band: 'hot', source: 'Website' }).map((e) => e.ref), ['E-0004']);
  assert.deepEqual(C.filterEnquiries(rows, { litter: 'L-EX1' }).map((e) => e.ref), ['E-0001', 'E-0003']);
  assert.deepEqual(C.filterEnquiries(rows, { country: 'Spain' }).map((e) => e.ref), ['E-0002']);
  assert.deepEqual(C.filterOptions(rows).band, ['hot', 'warm', 'cool']);
});

test('example rows are invented: example.test addresses and 07700 900xxx numbers only', () => {
  const s = JSON.stringify(fresh());
  for (const m of s.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []) assert.match(m, /@example\.test$/);
  for (const m of s.match(/\+44\d{10}/g) || []) assert.match(m, /^\+447700900\d{3}$/);
  assert.doesNotMatch(s, /licence number|\b[A-Z]{2,4}\d{3,}\b/i);
});
