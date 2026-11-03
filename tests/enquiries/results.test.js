// Stage 14: conversion reporting. Run: node --test tests/enquiries/results.test.js
// Invented months and invented people only. Every count and rate below is worked out by hand in the comments.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');

const ev = (k, type, at) => ({ event_key: 'V-' + k + type, enquiry_key: k, at_uk: at, type });
// May 2026: 4 Calendly, 3 email (one adult-dog) and one junk row. June: nothing. July: one new email enquiry.
const MAY = {
  Enquiries: [
    { key: 'K-A', channel: 'calendly', kind: 'puppy', stage: 'collected', received_uk: '2026-05-02T10:00:00' },
    { key: 'K-B', channel: 'calendly', kind: 'puppy', stage: 'call-held', received_uk: '2026-05-04T10:00:00' },
    { key: 'K-C', channel: 'calendly', kind: 'puppy', stage: 'lost', lost_reason: 'Timing', received_uk: '2026-05-06T10:00:00' },
    { key: 'K-D', channel: 'calendly', kind: 'puppy', stage: 'call-booked', received_uk: '2026-05-07T10:00:00' },
    { key: 'K-E', channel: 'email', kind: 'puppy', stage: 'replied', received_uk: '2026-05-08T09:00:00' },
    { key: 'K-F', channel: 'email', kind: 'puppy', stage: 'lost', lost_reason: 'went elsewhere', received_uk: '2026-05-09T09:00:00' },
    { key: 'K-G', channel: 'email', kind: 'puppy', stage: 'new', flag: 'junk?', received_uk: '2026-05-10T09:00:00' },
    { key: 'K-H', channel: 'email', kind: 'adult-dog', stage: 'viewing', received_uk: '2026-05-11T09:00:00' },
    { key: 'K-J', channel: 'email', kind: 'puppy', stage: 'new', received_uk: '2026-07-03T09:00:00' }
  ],
  Events: [
    ev('K-A', 'booked', '2026-05-02T10:00:00'), ev('K-A', 'replied', '2026-05-02T12:00:00'), ev('K-A', 'call-held', '2026-05-03T10:00:00'),
    ev('K-A', 'deposit-paid', '2026-05-04T10:00:00'),
    ev('K-B', 'booked', '2026-05-04T10:00:00'), ev('K-B', 'call-held', '2026-05-05T10:00:00'),
    ev('K-C', 'booked', '2026-05-06T10:00:00'),
    ev('K-D', 'booked', '2026-05-07T10:00:00'),
    ev('K-E', 'replied', '2026-05-08T12:00:00')
  ],
  'Sale Replies': [{ reply_key: 'S-1', enquiry_key: 'K-H', dog_ref: 'DOG-1' }]
};
const row = (rows, month, source) => rows.find((r) => r.month === month && r.source === source);

test('version is 1.13.0 and Results is the 14th tab', () => {
  assert.match(C.VERSION, /^enquiries-core 1\.13\.0 /);
  assert.equal(Object.keys(C.COLUMNS).length, 14);
  assert.equal(Object.keys(C.COLUMNS)[13], 'Results');
});

test('ACCEPT: counts per month and source from invented rows', () => {
  const rows = C.resultsRows(MAY);
  const all = row(rows, '2026-05', 'all');
  // A..H less the junk row G = 7. Booked: A B C D. Held: A B. Deposit, offer, balance, collected: A. Lost: C F.
  assert.deepEqual([all.enquiries, all.calls_booked, all.calls_held, all.deposits, all.offers, all.balances, all.collected, all.lost, all.junk, all.adult_sale],
    [7, 4, 2, 1, 1, 1, 1, 2, 1, 1]);
  const cal = row(rows, '2026-05', 'calendly');
  assert.deepEqual([cal.enquiries, cal.calls_booked, cal.calls_held, cal.deposits, cal.lost], [4, 4, 2, 1, 1]);
  const mail = row(rows, '2026-05', 'email');
  assert.deepEqual([mail.enquiries, mail.calls_booked, mail.junk, mail.adult_sale, mail.lost], [3, 0, 1, 1, 1]);
  // First reply: A 2 h, B 24 h (the call), E 3 h: median 3.
  assert.equal(all.median_reply_h, 3);
  assert.equal(all.lost_reasons, 'timing:1 | went elsewhere:1');
  assert.equal(row(rows, '2026-06', 'all'), undefined, 'no row is made for an empty month');
  for (const r of rows) for (const k of Object.keys(r)) assert.ok(C.COLUMNS.Results.includes(k), k + ' is a Results column');
});

test('ACCEPT: every rate right on invented months', () => {
  const r = C.resultRates(row(C.resultsRows(MAY), '2026-05', 'all'));
  const got = Object.fromEntries(r.steps.map((s) => [s.to, C.pct(s.rate)]));
  // booked 4/7 = 57%, held 2/4 = 50%, deposit 1/2 = 50%, offer 1/1, balance 1/1, collected 1/1.
  assert.deepEqual(got, { calls_booked: '57%', calls_held: '50%', deposits: '50%', offers: '100%', balances: '100%', collected: '100%' });
  assert.equal(r.deposits_per_10_calls, 5);   // 1 deposit per 2 calls held
  assert.equal(C.pct(r.overall), '14%');      // 1 of 7
  assert.equal(C.pct(r.lost), '29%');         // 2 of 7
  assert.equal(r.median_reply_h, 3);
  const cal = C.resultRates(row(C.resultsRows(MAY), '2026-05', 'calendly'));
  assert.equal(C.pct(cal.steps[0].rate), '100%');
  assert.equal(cal.deposits_per_10_calls, 5);
});

test('ACCEPT: a month with no data gives "no data", never 0%; a real 0 stays 0%', () => {
  const v = C.resultsView(MAY, { now: '2026-07-15T12:00:00Z', from: '2026-05-01' });
  assert.deepEqual(v.months.map((m) => m.month), ['2026-07', '2026-06', '2026-05']);
  const june = v.months[1];
  assert.equal(june.empty, true);
  assert.ok(june.rates.steps.every((s) => s.rate === null && C.pct(s.rate) === 'no data'));
  assert.equal(june.rates.deposits_per_10_calls, null);
  assert.equal(june.rates.median_reply_h, null);
  const july = v.months[0];
  assert.equal(C.pct(july.rates.steps[0].rate), '0%', 'one enquiry, no call: 0% is right');
  assert.equal(C.pct(july.rates.steps[1].rate), 'no data', 'no call booked: held rate has no data');
  assert.equal(v.total.enquiries, 8);
  assert.equal(v.adultSale, 1);
  assert.equal(v.medianReplyAll, 3);
  assert.deepEqual(v.sources, ['calendly', 'email']);
});

test('lost rows keep the steps their Events show; adult-dog stages never count as calls', () => {
  const rows = C.resultsRows({ Enquiries: [
    { key: 'K-1', channel: 'email', kind: 'puppy', stage: 'lost', received_uk: '2026-08-01T09:00:00' },
    { key: 'K-2', channel: 'email', kind: 'adult-dog', stage: 'viewing', received_uk: '2026-08-02T09:00:00' }
  ], Events: [ev('K-1', 'booked', '2026-08-01T10:00:00'), ev('K-1', 'call-held', '2026-08-02T10:00:00')] });
  const all = row(rows, '2026-08', 'all');
  assert.deepEqual([all.enquiries, all.calls_booked, all.calls_held, all.lost, all.adult_sale], [2, 1, 1, 1, 1]);
  assert.equal(all.lost_reasons, 'no reason given:1');
  assert.equal(C.resultsRows(MAY, { from: '2026-07-01' }).filter((r) => r.source === 'all').length, 1, 'from leaves out earlier months');
});

// ---- History import ------------------------------------------------------------------------------------------
const DEALS = C.parseCsv([
  'Deal Name,Deal Stage,Create Date,Email,First Name,Last Name,Closed Lost Reason',
  'Pup for Sam,closedwon,2025-11-03 10:00,sam.rivers@example.com,Sam,Rivers,',
  'Pup for Ann,appointmentscheduled,2025-11-10 10:00,ann.oak@example.com,Ann,Oak,',
  'Pup for Joe,Closed Lost,2025-12-01 10:00,joe.elm@example.com,Joe,Elm,Timing',
  'Pup for Kim,Deposit paid,2025-12-02 10:00,kim.ash@example.com,Kim,Ash,',
  'XkQwPzLmRt,closedlost,2025-12-03 10:00,xk@example.com,XkQwPzLmRt,,',
  'Pup for Lee,closedwon,2025-12-04 10:00,lee.fir@example.test,Lee,Fir,',
  'Test deal,closedwon,2025-12-05 10:00,ok.person@example.com,Ok,Person,',
  'Pup for Max,presentationscheduled,2026-06-01 10:00,max.yew@example.com,Max,Yew,'
].join('\n'));
const CONTACTS = C.parseCsv([
  'First Name,Last Name,Email,Phone Number,Create Date,Lifecycle Stage',
  'Sam,Rivers,sam.rivers@example.com,07700 900111,2025-11-01,customer',
  'Pat,Bay,pat.bay@example.com,07700 900222,2025-12-05,lead',
  'Ria,Lime,ria.lime@example.com,,not a date,lead'
].join('\n'));

test('ACCEPT: the spam filter flags an invented random-letter name and a test-domain address', () => {
  assert.ok(C.junkReasons({ name: 'XkQwPzLmRt', email: 'xk@example.com' }, { testDomains: [] }).includes('random letters name'));
  assert.ok(C.junkReasons({ name: 'Lee Fir', email: 'lee.fir@example.test' }, { testDomains: [] }).includes('test or throwaway domain'));
  assert.deepEqual(C.junkReasons({ name: 'Sam Rivers', email: 'sam.rivers@example.com' }, { testDomains: [] }), []);
});

test('HubSpot stages map to the hub stages', () => {
  const m = (s) => C.hubspotStage(s);
  assert.deepEqual(['closedwon', 'Closed Lost', 'contractsent', 'presentationscheduled', 'Deposit paid', 'qualifiedtobuy', 'appointmentscheduled', 'lead', 'customer', 'opportunity', ''].map(m),
    ['collected', 'lost', 'balance', 'offered', 'deposit', 'call-held', 'call-booked', 'new', 'collected', 'call-held', 'new']);
});

test('HubSpot history: spam and test entries left out, contacts on a deal count once, only rows before the cut', () => {
  const h = C.hubspotHistoryFrom([CONTACTS, DEALS], { before: '2026-05-01', testDomains: [] });
  // 8 deals + 3 contacts read. Junk: random name, test domain, "Test deal" = 3. Later: Max. Sam's contact is on a deal.
  // Ria has no date. Counted: Sam, Ann, Joe, Kim (deals) + Pat (contact) = 5.
  assert.deepEqual([h.read, h.junk, h.later, h.undated, h.counted], [11, 3, 1, 1, 5]);
  assert.deepEqual(h.stages, { collected: 1, 'call-booked': 1, lost: 1, deposit: 1, new: 1 });
  const nov = h.rows.find((r) => r.month === '2025-11'), dec = h.rows.find((r) => r.month === '2025-12');
  assert.equal(nov.basis, 'hubspot-history'); assert.equal(nov.source, 'hubspot-legacy');
  assert.deepEqual([nov.enquiries, nov.calls_booked, nov.calls_held, nov.collected], [2, 2, 1, 1]);
  assert.deepEqual([dec.enquiries, dec.deposits, dec.lost, dec.lost_reasons], [3, 1, 1, 'timing:1']);
  const text = JSON.stringify(h);
  for (const bit of ['Sam', 'Rivers', '@example', '07700']) assert.ok(!text.includes(bit), 'no person detail kept: ' + bit);
});

test('old deposit list: counts per month only, before the cut; no date column gives nothing', () => {
  const d = C.depositHistoryFrom([['name', 'deposit_date', 'deposit'], ['Person A', '2025-10-02', '1'], ['Person B', '12/10/2025', '1'],
    ['Person C', '2025-11-20', '1'], ['Person D', '', '1'], ['Person E', '2026-06-01', '1'], ['', '', '']], { before: '2026-05-01' });
  assert.deepEqual([d.read, d.counted, d.undated, d.later], [5, 3, 1, 1]);
  assert.deepEqual(d.rows.map((r) => [r.month, r.deposits, r.basis]), [['2025-10', 2, 'deposit-list'], ['2025-11', 1, 'deposit-list']]);
  assert.ok(!JSON.stringify(d).includes('Person'));
  assert.equal(C.depositHistoryFrom([['name', 'amount'], ['x', '1']]).nodate_column, true);
});

test('history rows join the view: months before May are listed and added to "all"', () => {
  const h = C.hubspotHistoryFrom([DEALS], { before: '2026-05-01', testDomains: [] });
  const v = C.resultsView(Object.assign({}, MAY, { Results: h.rows }), { now: '2026-07-15T12:00:00Z', from: '2026-05-01' });
  assert.equal(v.months[v.months.length - 1].month, '2025-11');
  const nov = v.months.find((m) => m.month === '2025-11');
  assert.equal(nov.total.enquiries, 2);
  assert.equal(nov.bySource[0].row.source, 'hubspot-legacy');
  assert.equal(C.pct(nov.rates.steps[0].rate), '100%');
  assert.ok(v.months.find((m) => m.month === '2026-01').empty, 'a gap month between history and live shows no data');
  assert.ok(v.sources.includes('hubspot-legacy'));
});
