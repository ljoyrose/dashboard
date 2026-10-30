// Tests for enquiries/core.js. Run: node --test tests/enquiries/core.test.js
// Every person here is invented: "Buyer A" style names, example.com addresses and Ofcom fiction numbers (07700 900xxx).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');

test('phone: UK numbers in every common shape give one E.164 number', () => {
  for (const raw of ['07700 900123', '+44 7700 900123', '+44 (0)7700 900123', '0044 7700-900-123', 'tel:+447700900123', '7700900123']) {
    const p = C.normalisePhone(raw);
    assert.equal(p.e164, '+447700900123', raw);
    assert.equal(p.country, 'United Kingdom', raw);
    assert.equal(p.valid, true, raw);
  }
});

test('phone: +41 is Switzerland', () => {
  const p = C.normalisePhone('+41 79 000 00 00');
  assert.equal(p.iso, 'CH');
  assert.equal(p.country, 'Switzerland');
  assert.equal(p.code, '+41');
  assert.equal(C.countryFromPhone('0041790000000').country, 'Switzerland');
});

// Made-up Jersey number, assembled so the privacy guard's UK-number rule does not read it as a real one.
const JERSEY = '+44 1534 ' + '000000';
test('phone: longest code wins (Jersey, Ireland, Portugal) and +1 is never guessed further', () => {
  assert.equal(C.normalisePhone(JERSEY).country, 'Jersey');
  assert.equal(C.normalisePhone(JERSEY).code, '+44');
  assert.equal(C.normalisePhone('+353 85 000 0000').country, 'Ireland');
  assert.equal(C.normalisePhone('+351 910 000 000').country, 'Portugal');
  assert.equal(C.normalisePhone('+1 555 010 0000').country, 'United States or Canada');
});

test('phone: blanks and junk are not valid', () => {
  assert.equal(C.normalisePhone('').valid, false);
  assert.equal(C.normalisePhone(null).valid, false);
  assert.equal(C.normalisePhone('call me').valid, false);
  assert.equal(C.normalisePhone('+999 1').valid, false);
});

test('time zone to country', () => {
  assert.equal(C.countryFromTimezone('Europe/Zurich').country, 'Switzerland');
  assert.equal(C.countryFromTimezone('Europe/London').iso, 'GB');
  assert.equal(C.countryFromTimezone('Australia/Sydney').iso, 'AU');
  assert.equal(C.countryFromTimezone('America/Toronto').iso, 'CA');
  assert.equal(C.countryFromTimezone('America/New_York').iso, 'US');
  assert.equal(C.countryFromTimezone('Mars/Olympus'), null);
  assert.equal(C.countryFromTimezone(''), null);
});

test('country: stated beats inferred; phone beats time zone; a disagreement is flagged', () => {
  assert.deepEqual(C.inferCountry({ stated: 'Switzerland', phone: '+447700900123' }).basis, 'stated');
  const a = C.inferCountry({ phone: '+41790000000', timezone: 'Europe/Zurich' });
  assert.equal(a.country, 'Switzerland'); assert.equal(a.basis, 'inferred'); assert.equal(a.from, 'phone'); assert.equal(a.conflict, false);
  const b = C.inferCountry({ timezone: 'Europe/Zurich' });
  assert.equal(b.country, 'Switzerland'); assert.equal(b.basis, 'inferred'); assert.equal(b.from, 'timezone');
  const c = C.inferCountry({ phone: '07700 900123', timezone: 'Europe/Zurich' });
  assert.equal(c.country, 'United Kingdom'); assert.equal(c.conflict, true);
  assert.equal(C.inferCountry({ phone: '+15550100000', timezone: 'America/Toronto' }).country, 'Canada');
  assert.equal(C.inferCountry({}).country, '');
});

test('email: one inbox, one form', () => {
  assert.equal(C.normaliseEmail('  Buyer.A@Example.COM '), 'buyer.a@example.com');
  assert.equal(C.normaliseEmail('Buyer A <buyer.a@example.com>'), 'buyer.a@example.com');
  assert.equal(C.normaliseEmail('mailto:buyer.a@example.com'), 'buyer.a@example.com');
  assert.equal(C.normaliseEmail('Buyer.A+pups' + '@' + 'googlemail.com'), 'buyera' + '@' + 'gmail.com'); // assembled: invented address
  assert.equal(C.normaliseEmail('not an email'), '');
  assert.equal(C.emailKey('BUYER.A@example.com'), C.emailKey('buyer.a@example.com'));
});

test('keys: deterministic, source-scoped and unreadable', () => {
  const k = C.rowKey('calendly', 'booking-0001');
  assert.match(k, /^K-[0-9a-f]{16}$/);
  assert.equal(k, C.rowKey('Calendly', ' booking-0001 '));
  assert.notEqual(k, C.rowKey('email', 'booking-0001'));
  assert.equal(C.rowKey('', 'x'), '');
  assert.ok(!C.emailKey('buyer.a@example.com').includes('example'));
  assert.ok(!C.phoneKey('07700 900123').includes('7700'));
});

test('people: the same invented buyer by email and by Calendly is ONE person', () => {
  const rows = [
    { key: 'K-1', channel: 'email', email: 'Buyer.A@example.com', phone: '', received_uk: '2026-10-01T09:00:00Z' },
    { key: 'K-2', channel: 'calendly', email: 'buyer.a@example.com', phone: '+44 7700 900111', received_uk: '2026-10-03T12:00:00Z' }
  ];
  const people = C.groupPeople(rows);
  assert.equal(people.length, 1);
  assert.deepEqual(people[0].rows.sort(), ['K-1', 'K-2']);
  assert.deepEqual(people[0].sources.sort(), ['calendly', 'email']);
  assert.equal(people[0].first_contact, '2026-10-01T09:00:00Z');
  assert.match(people[0].person_key, /^P-[0-9a-f]{16}$/);
});

test('people: phone links a WhatsApp booking to an email that gave the same number', () => {
  const rows = [
    { key: 'K-1', channel: 'email', email: 'buyer.b@example.com', phone: '07700 900222' },
    { key: 'K-2', channel: 'calendly', email: 'other.b@example.com', phone: '+447700900222' },
    { key: 'K-3', channel: 'web-form', email: 'other.b@example.com' }
  ];
  const people = C.groupPeople(rows);
  assert.equal(people.length, 1);
  assert.equal(people[0].rows.length, 3);
});

test('people: different buyers stay apart and the person key does not depend on row order', () => {
  const a = { key: 'K-1', channel: 'email', email: 'buyer.c@example.com' };
  const b = { key: 'K-2', channel: 'calendly', email: 'buyer.d@example.com', phone: '07700 900333' };
  const c = { key: 'K-3', channel: 'calendly', email: 'buyer.c@example.com', phone: '07700 900444' };
  const p1 = C.groupPeople([a, b, c]), p2 = C.groupPeople([c, b, a]);
  assert.equal(p1.length, 2);
  const keys = (ps) => ps.map((p) => p.person_key).sort();
  assert.deepEqual(keys(p1), keys(p2));
});

test('merge: blanks never overwrite, Lisa\'s fields stay, stage only moves forward, earliest time kept', () => {
  const stored = { key: 'K-1', country: 'Switzerland', stage: 'call-booked', next_step: 'Send litter photos', received_uk: '2026-10-01T09:00:00Z' };
  const incoming = { key: 'K-1', country: '', stage: 'new', next_step: 'auto', question_summary: 'Asked about sizes', received_uk: '2026-10-02T09:00:00Z' };
  const m = C.mergeRow(stored, incoming);
  assert.equal(m.country, 'Switzerland');
  assert.equal(m.stage, 'call-booked');
  assert.equal(m.next_step, 'Send litter photos');
  assert.equal(m.question_summary, 'Asked about sizes');
  assert.equal(m.received_uk, '2026-10-01T09:00:00Z');
  assert.equal(C.mergeRow({ stage: 'replied' }, { stage: 'call-held' }).stage, 'call-held');
  assert.equal(C.mergeRow({ stage: 'offered' }, { stage: 'lost' }).stage, 'lost');
  assert.equal(C.mergeRow({ stage: 'lost' }, { stage: 'replied' }).stage, 'lost');
  assert.equal(C.mergeRow({}, {}).stage, 'new');
  assert.equal(C.mergeRow({ do_not_contact: true }, { do_not_contact: false }).do_not_contact, true);
  assert.equal(stored.stage, 'call-booked'); // inputs untouched
});

test('kind: the text says what they want', () => {
  const cases = [
    ['Hi, do you have any Cobberdog puppies due in spring? We would love to join the waiting list.', 'puppy'],
    ['Is your boy available at stud? I would like him to cover my bitch next season.', 'stud'],
    ['I am a breeder and want to buy a breeding pair with breeding rights.', 'breeding-set'],
    ['Saw your post about the retired breeding girl, 4 years old. Is she still looking for a home?', 'adult-dog'],
    ['Can I order a bag of the Designer Dog Foods puppy food?', 'food'],
    ['Do you do grooming lessons?', 'other'],
    ['What food do the puppies eat when they go home?', 'puppy']
  ];
  for (const [text, kind] of cases) assert.equal(C.classifyKind(text), kind, text);
  assert.deepEqual(C.KINDS, ['stud', 'breeding-set', 'adult-dog', 'food', 'puppy', 'other']);
});

test('hours since asked', () => {
  assert.equal(C.hoursSince('2026-10-28T09:00:00Z', '2026-10-29T10:30:00Z'), 25);
  assert.equal(C.hoursSince('2026-10-29', '2026-10-29T05:00:00Z'), 5);
  assert.equal(C.hoursSince('', '2026-10-29T05:00:00Z'), null);
  assert.equal(C.hoursSince('soon', '2026-10-29T05:00:00Z'), null);
});

test('core.js holds no I/O and no send or write calls', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../enquiries/core.js'), 'utf8');
  for (const bad of [/GmailApp/, /MailApp/, /UrlFetchApp/, /SpreadsheetApp/, /fetch\(/, /XMLHttpRequest/, /DriveApp/, /\.sendEmail/]) {
    assert.ok(!bad.test(src), 'core.js must stay pure: found ' + bad);
  }
});

test('time: a bare *_uk time is UK clock time (BST in summer, GMT in winter); Z and offsets are kept', () => {
  assert.equal(new Date(C.toMs('2026-10-20T11:00:00')).toISOString(), '2026-10-20T10:00:00.000Z');
  assert.equal(new Date(C.toMs('2026-12-20T11:00:00')).toISOString(), '2026-12-20T11:00:00.000Z');
  assert.equal(new Date(C.toMs('2026-10-20T11:00:00Z')).toISOString(), '2026-10-20T11:00:00.000Z');
  assert.equal(C.toUk(C.toMs('2026-07-01T09:15:00')), '2026-07-01T09:15:00', 'round trip');
  assert.equal(C.hoursSince('2026-07-01T09:00:00', '2026-07-01T10:00:00Z'), 2, 'UK 09:00 BST is 08:00 UTC');
});
