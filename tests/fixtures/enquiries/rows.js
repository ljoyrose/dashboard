// Invented RR_ENQUIRIES rows for the enquiries tests. Nobody here is real: "Buyer A" style names, example.com addresses,
// Ofcom fiction numbers (+44 7700 900xxx) and made-up refs. Shaped exactly like the Sheets API values (header row first).
'use strict';
const C = require('../../../enquiries/core.js');

const H = C.COLUMNS.Enquiries;
function row(o) { return H.map((c) => (o[c] === undefined ? '' : o[c])); }

const enquiries = [
  { key: 'K-0000000000000001', person_key: 'P-00000000000000a1', source: 'Calendly', source_ref: 'booking-0001', received_uk: '2026-10-27T10:15:00', channel: 'calendly', kind: 'puppy', brand: 'Cobberdogs', country: 'Switzerland', country_basis: 'inferred', breed_interest: 'Cobberdog', size: 'medium', colour: 'chocolate', coat: 'fleece', sex: 'female', timing: 'spring 2027', question_summary: 'Asked about a girl in spring', score: 82, band: 'hot', stage: 'call-booked', next_step: 'Prep the call', next_due_uk: '2026-10-30T09:00:00', consent: 'ok', do_not_contact: false, ref: 'E-0001' },
  { key: 'K-0000000000000002', person_key: 'P-00000000000000b2', source: 'Website Optin', source_ref: 'run-0002', received_uk: '2026-08-01T19:40:00', channel: 'cf-website-optin', kind: 'puppy', brand: 'Labradoodles', country: 'United Kingdom', country_basis: 'stated', breed_interest: 'either', score: 55, band: 'warm', stage: 'new', consent: 'unknown', do_not_contact: false, flag: 'missed', ref: 'E-0002' },
  { key: 'K-0000000000000003', person_key: 'P-00000000000000c3', source: 'Gmail', source_ref: 'thread-0003', received_uk: '2026-10-20T08:00:00', channel: 'email', kind: 'stud', brand: 'Cobberdogs', country: 'United Kingdom', country_basis: 'stated', score: 20, band: 'cool', stage: 'replied', consent: 'ok', do_not_contact: false, ref: 'E-0003' },
  { key: 'K-0000000000000004', person_key: 'P-00000000000000d4', source: 'Added by hand', source_ref: 'req-0004', received_uk: '2026-10-25T12:00:00', channel: 'facebook', kind: 'adult-dog', brand: 'Cobberdogs', country: 'Spain', country_basis: 'stated', score: 40, band: 'warm', stage: 'asked', consent: 'do-not-contact', do_not_contact: true, ref: 'E-0004' },
  { key: 'K-0000000000000005', person_key: 'P-00000000000000e5', source: 'Calendly', source_ref: 'booking-0005', received_uk: '2026-09-02T16:30:00', channel: 'calendly', kind: 'puppy', brand: 'Cobberdogs', country: 'United Kingdom', country_basis: 'inferred', score: 75, band: 'hot', stage: 'deposit', litter_ref: 'ms26', consent: 'ok', do_not_contact: false, ref: 'E-0005' }
];

const people = [
  { person_key: 'P-00000000000000a1', ref: 'E-0001', name: 'Buyer A', email: 'buyer.a@example.com', phone_e164: '+447700900101', country: 'Switzerland', country_basis: 'inferred', sources: 'calendly', consent: 'ok' },
  { person_key: 'P-00000000000000b2', ref: 'E-0002', name: 'Buyer B', email: 'buyer.b@example.com', phone_e164: '+447700900102', country: 'United Kingdom', country_basis: 'stated', sources: 'cf-website-optin', consent: 'unknown' }
];

function values(tab, objs) { return [C.COLUMNS[tab].slice()].concat(objs.map((o) => C.COLUMNS[tab].map((c) => (o[c] === undefined ? '' : o[c])))); }

module.exports = {
  enquiries,
  people,
  enquiriesValues: () => [H.slice()].concat(enquiries.map(row)),
  peopleValues: () => values('People', people),
  values
};
