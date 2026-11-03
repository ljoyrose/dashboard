// Stage 8: reply drafts. Run: node --test tests/enquiries/drafts.test.js
// Every person here is invented. A draft is text in a copy box: nothing here sends anything.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');

const ALL = (o) => C.DRAFT_CASES.map((k) => [k, C.buildDraft(k, Object.assign({ name: 'Buyer Sample' }, o))]);
const STOP = { breeder: 1, missed: 1 };

test('ACCEPT: every case, email and WhatsApp, passes the draft check', () => {
  for (const country of ['United Kingdom', 'Switzerland', '']) {
    for (const [k, d] of ALL({ country, prefs: { colour: 'chocolate', size: 'medium' } })) {
      assert.deepEqual(C.checkDraft(d.email.text, { stop: !!STOP[k] }), [], k + ' email');
      assert.deepEqual(C.checkDraft(d.whatsapp, { stop: k === 'breeder' || k === 'missed' }), [], k + ' WhatsApp');
      assert.ok(d.links.length >= 1 && d.links.every((l) => /^https:\/\//.test(l)), k);
      assert.ok(d.email.subject, k);
    }
  }
});

test('ACCEPT: the check fails a price, a £ figure, COI, hypoallergenic alone, a licence number, puppyclassroom.com or no link', () => {
  const ok = 'Hi, have a look at https://doc.labradoodles.co.uk/breed. Kind regards, Lisa';
  assert.deepEqual(C.checkDraft(ok), []);
  const bad = [
    ['a price or money figure', ok + ' The price is 2500.'],
    ['a price or money figure', ok + ' Only £2,000.'],
    ['a price or money figure', ok + ' About 1800 pounds.'],
    ['a price or money figure', ok + ' CHF 3000.'],
    ['a COI value', ok + ' Her COI is low.'],
    ['a COI value', ok + ' 4.2% inbreeding.'],
    ['"hypoallergenic" without "low-shedding"', ok + ' They are hypoallergenic.'],
    ['a licence number or licence-number pattern', ok + ' Licence number on request.'],
    ['a licence number or licence-number pattern', ok + ' Ref XYZ 0042.'],
    ['a puppyclassroom.com link', ok + ' See puppyclassroom.com/start'],
    ['no info link', 'Hi, thanks. Kind regards, Lisa']
  ];
  for (const [why, t] of bad) assert.ok(C.checkDraft(t).includes(why), why + ': ' + t);
  assert.deepEqual(C.checkDraft(ok + ' Low-shedding and often called hypoallergenic.'), []);
  assert.ok(C.checkDraft(ok, { stop: true }).includes('no STOP line on a cold message'));
});

test('ACCEPT: an invented Swiss buyer gets an official government page or "Lisa to confirm"', () => {
  const d = C.buildDraft('first-abroad', { name: 'Buyer Swiss', country: 'Switzerland' });
  assert.match(d.email.text, /https:\/\/www\.gov\.uk\/taking-your-pet-abroad/);
  assert.match(d.email.text, /Lisa to confirm/);
  assert.match(d.whatsapp, /Lisa to confirm/);
  // Lisa's own official page from Settings replaces the fallback; a non-government link is ignored.
  const own = C.buildDraft('first-abroad', { country: 'Switzerland', importPages: 'Switzerland=https://www.blv.admin.ch/example-page; Spain=https://example.com/rules' });
  assert.match(own.email.text, /blv\.admin\.ch/);
  assert.doesNotMatch(own.email.text, /Lisa to confirm/);
  const es = C.buildDraft('first-abroad', { country: 'Spain', importPages: 'Spain=https://example.com/rules' });
  assert.doesNotMatch(es.email.text, /example\.com/);
  assert.match(es.email.text, /Lisa to confirm/);
});

test('adult dogs say "price on request"; cold breeder and missed-enquiry messages carry the STOP line', () => {
  assert.match(C.buildDraft('adult-dog', {}).email.text, /Prices are on request/);
  for (const k of ['breeder', 'missed']) {
    assert.match(C.buildDraft(k, {}).email.text, /reply STOP/);
    assert.match(C.buildDraft(k, {}).whatsapp, /STOP/);
  }
  assert.doesNotMatch(C.buildDraft('first-uk', {}).email.text, /STOP/);
});

test('the missed-enquiry apology follows Appendix B: subject, apology, the five links, sign-off', () => {
  const d = C.buildDraft('missed', { name: 'buyer' });
  assert.equal(d.email.subject, 'Your puppy enquiry with Australian Labradoodles/Cobberdogs');
  assert.match(d.email.text, /^Hi Buyer,/);
  assert.match(d.email.text, /so sorry for the very slow reply/);
  assert.equal(d.links.length, 5);
  for (const p of ['breed', 'sizes', 'colour', 'coats', 'health-tests']) assert.ok(d.email.text.includes('https://doc.labradoodles.co.uk/' + p), p);
  assert.match(d.email.text, /Kind regards,\n\nLisa\n\nAustralian Labradoodles\/Cobberdogs, www\.cobberdogs\.com/);
});

test('links follow what they asked; no name gives "Hi there"', () => {
  assert.deepEqual(C.linksFor('first-uk', { coat: 'fleece' }), ['https://doc.labradoodles.co.uk/breed', 'https://doc.labradoodles.co.uk/coats']);
  assert.deepEqual(C.linksFor('first-uk', {}), ['https://doc.labradoodles.co.uk/breed', 'https://doc.labradoodles.co.uk/health-tests']);
  assert.match(C.buildDraft('first-uk', { name: '' }).email.text, /^Hi there,/);
  assert.equal(C.firstName('bUYER sample'), 'Buyer');
  assert.equal(C.firstName('x@example.com'), '');
});

test('case choice: missed after 7 days, abroad, adult dog, breeder, after a call; a pup offer is never chosen by itself', () => {
  const now = '2026-10-30T10:00:00Z';
  const c = (e) => C.chooseCase(Object.assign({ stage: 'new', kind: 'puppy', country: 'United Kingdom', received_uk: '2026-10-29T10:00:00' }, e), { now });
  assert.equal(c({}), 'first-uk');
  assert.equal(c({ country: 'Switzerland' }), 'first-abroad');
  assert.equal(c({ received_uk: '2026-08-01T10:00:00' }), 'missed');
  assert.equal(c({ kind: 'adult-dog' }), 'adult-dog');
  assert.equal(c({ channel: 'cf-breeding', kind: 'other' }), 'breeder');
  assert.equal(c({ stage: 'call-held' }), 'after-call');
  assert.equal(c({ stage: 'replied' }), '');
  assert.ok(!C.AUTO_CASES.includes('pup-offer') && !C.AUTO_CASES.includes('waiting-list'));
});

test('styleSample stripping: no email, number, price, reference or recipient name survives; quoted text is cut', () => {
  const raw = ['Hi Buyerina,', '', 'Thank you so much for your message! I\'d love to help.', 'Call me on 07700 900501 or email buyer.x@example.com.',
    'Our girls are £2,500 and the ref is XYZ 0042. See https://doc.labradoodles.co.uk/breed?utm=1.', 'Buyerina, your garden sounds perfect.', '',
    'Kind regards,', 'Lisa', '', 'On Mon, 1 Sep 2026 at 10:00, Buyerina Sample <buyer.x@example.com> wrote:', '> Hello, do you have puppies?'].join('\n');
  const r = C.stripForStyle(raw, { names: ['Buyerina Sample'] });
  assert.doesNotMatch(r.text, /Buyerina|Sample|7700|example\.com|2,500|XYZ|do you have puppies/);
  assert.match(r.text, /^Hi <name>,/);
  assert.match(r.text, /<number>/); assert.match(r.text, /<email>/); assert.match(r.text, /<price>/); assert.match(r.text, /<ref>/);
  assert.equal(r.greeting, 'Hi <name>,');
  assert.match(r.sign_off, /Kind regards/);
  assert.deepEqual(r.links, ['https://doc.labradoodles.co.uk/breed']);
  assert.ok(r.words > 20);
});
