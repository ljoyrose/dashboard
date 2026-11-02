// Stage 7: triage and scoring. Run: node --test tests/enquiries/score.test.js
// Every enquiry here is invented. "now" is fixed so the timing words give the same months every run.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');

const NOW = '2026-10-30T10:00:00Z';
const PUPS = [
  { pup_ref: 'xx26-01', sex: 'female', colour: 'chocolate', size: 'medium', coat: 'fleece', status: 'open' },
  { pup_ref: 'xx26-02', sex: 'male', colour: 'cream', size: 'miniature', coat: 'wool', status: 'open' },
  { pup_ref: 'xx26-03', sex: 'female', colour: 'caramel', size: 'medium', coat: 'fleece', status: 'sold' }
];
const ctx = (o) => Object.assign({ now: NOW, openPups: PUPS, simpleCountries: 'Ireland', hardCountries: 'Australia, New Zealand' }, o);
const HOT_TEXT = 'Looking for a chocolate girl asap. We have a fenced garden and had dogs before; happy to pay a deposit.';

const CASES = [
  // [label, enquiry, ctx overrides, expected band, expected score]
  ['UK call, fits, ready', { kind: 'puppy', channel: 'calendly', country: 'United Kingdom', question_summary: HOT_TEXT }, {}, 'hot', 85],
  ['repeat buyer, January, name down', { kind: 'puppy', channel: 'email', stage: 'call-booked', country: 'United Kingdom', question_summary: 'Would love another pup in January, ready to put our name down' }, { person: { repeat_buyer: true } }, 'hot', 83],
  ['UK call, girl in summer, garden', { kind: 'puppy', channel: 'calendly', country: 'United Kingdom', question_summary: 'A girl please, sometime in summer. Big garden.' }, {}, 'warm', 50],
  ['Ireland call, Cobberdog girl in 2 months', { kind: 'puppy', channel: 'calendly', country: 'Ireland', question_summary: 'Cobberdog girl in 2 months' }, {}, 'warm', 55],
  ['Swiss email, colours, within 6 months, had dogs', { kind: 'puppy', channel: 'email', country: 'Switzerland', question_summary: 'What colours do you have? Within 6 months. We have had dogs all our lives.' }, {}, 'cool', 28],
  ['Spain, shipping question', { kind: 'puppy', channel: 'email', country: 'Spain', question_summary: 'Do you ship to Spain?' }, {}, 'not-a-fit', 8],
  ['UK stud in 3 weeks', { kind: 'stud', channel: 'email', country: 'United Kingdom', question_summary: 'Stud for my bitch in 3 weeks' }, {}, 'cool', 30],
  ['as case 1 plus autism and allergies', { kind: 'puppy', channel: 'calendly', country: 'United Kingdom', question_summary: HOT_TEXT + ' My son has autism and I have allergies.' }, {}, 'hot', 85],
  ['web form, 2 year old, asap', { kind: 'puppy', channel: 'web-form', country: 'United Kingdom', question_summary: 'We have a 2 year old, looking for a puppy asap' }, {}, 'cool', 38],
  ['blank message, no open pups', { kind: 'puppy', channel: 'cf-website-optin', country: '', question_summary: '' }, { openPups: [] }, 'not-a-fit', 0]
];

test('ACCEPT: 10 invented enquiries give the expected bands', () => {
  for (const [label, e, o, band, score] of CASES) {
    const r = C.scoreEnquiry(e, ctx(o));
    assert.equal(r.band, band, label + ': ' + JSON.stringify(r));
    assert.equal(r.score, score, label + ': ' + r.reasons.join(' | '));
  }
});

test('ACCEPT: every score has 1 to 3 reasons, each naming its points', () => {
  for (const [label, e, o] of CASES) {
    const r = C.scoreEnquiry(e, ctx(o));
    assert.ok(r.reasons.length >= 1 && r.reasons.length <= 3, label);
    for (const why of r.reasons) assert.match(why, /\((\+\d+|0)\)$/, label + ': ' + why);
  }
  const top = C.scoreEnquiry(CASES[0][1], ctx({})).reasons;
  assert.deepEqual(top, ['Wants a pup within 3 months (+20)', '1 open pup fits what they asked (+15)', 'Talks about a deposit or reserving (+15)']);
});

test('sensitive flags are shown, never scored down', () => {
  const plain = C.scoreEnquiry(CASES[0][1], ctx({}));
  const flagged = C.scoreEnquiry(CASES[7][1], ctx({}));
  assert.equal(flagged.score, plain.score);
  assert.deepEqual(flagged.flags, ['allergies', 'neurodiverse home']);
  assert.deepEqual(C.scoreEnquiry(CASES[8][1], ctx({})).flags, ['young children']);
  const au = C.scoreEnquiry({ kind: 'puppy', country: 'Australia', question_summary: 'A boy asap' }, ctx({}));
  const nz = C.scoreEnquiry({ kind: 'puppy', country: 'Canada', question_summary: 'A boy asap' }, ctx({}));
  assert.deepEqual(au.flags, ['export to Australia']);
  assert.equal(au.score, nz.score, 'a hard country is a flag, not a lower score');
});

test('weights and bands come from Settings text', () => {
  const e = CASES[0][1];
  const r = C.scoreEnquiry(e, ctx({ weights: 'timing=0, call=0', bands: 'hot=90, warm=40, cool=10' }));
  assert.equal(r.score, 50);
  assert.equal(r.band, 'warm');
  assert.equal(C.scoreEnquiry(e, ctx({ weights: 'nonsense, timing=abc' })).score, 85, 'bad text keeps the defaults');
});

test('timing words to months ahead', () => {
  const m = (t) => C.timingMonths(t, NOW);
  assert.equal(m('asap'), 0); assert.equal(m('next month'), 1); assert.equal(m('in 6 weeks'), 1);
  assert.equal(m('within 3 months'), 3); assert.equal(m('January'), 3); assert.equal(m('spring 2027'), 5);
  assert.equal(m('next year'), 3); assert.equal(m('just curious'), null);
});

test('prefs from text fill only blank fields; pupFits treats blank and "either" as any', () => {
  assert.deepEqual(C.extractPrefs('a mini choc boy, fleece please, Cobberdog or Labradoodle', {}), { sex: 'male', size: 'miniature', colour: 'chocolate', coat: 'fleece', breed_interest: 'either' });
  assert.equal(C.extractPrefs('a girl', { sex: 'male' }).sex, 'male');
  assert.equal(C.pupFits({ sex: 'female', colour: 'chocolate' }, PUPS[0]), true);
  assert.equal(C.pupFits({ sex: 'female', colour: 'cream' }, PUPS[0]), false);
  assert.equal(C.pupFits({ size: 'either' }, PUPS[1]), true);
});
