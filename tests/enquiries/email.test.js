// Email and website-form capture (JOB 13 Stage 4). Run: node --test tests/enquiries/email.test.js
// 12 invented emails (tests/fixtures/enquiries/emails.js): 6 enquiries, 6 noise.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');
const { emails, FORM_SENDERS, NOISE_SENDERS } = require('../fixtures/enquiries/emails.js');

const judge = (m) => C.classifyEmail(Object.assign({ formSenders: FORM_SENDERS, noiseSenders: NOISE_SENDERS }, m));

test('the classifier gets 12 of 12 invented emails right (6 enquiries, 6 noise)', () => {
  let right = 0;
  const wrong = [];
  for (const m of emails) {
    const r = judge(m);
    const ok = r.enquiry === m.want.enquiry && (!m.want.channel || r.channel === m.want.channel) && (!m.want.kind || r.kind === m.want.kind);
    if (ok) right++; else wrong.push(m.id + ' -> ' + JSON.stringify({ enquiry: r.enquiry, channel: r.channel, kind: r.kind, reason: r.reason }));
  }
  assert.equal(emails.filter((m) => m.want.enquiry).length, 6);
  assert.equal(emails.filter((m) => !m.want.enquiry).length, 6);
  assert.equal(right, 12, wrong.join('\n'));
});

test('noise includes a supplier invoice and an SEO report, each with a reason', () => {
  assert.equal(judge(emails.find((m) => m.id === 'noise-invoice')).enquiry, false);
  assert.equal(judge(emails.find((m) => m.id === 'noise-seo')).enquiry, false);
  for (const m of emails.filter((x) => !x.want.enquiry)) assert.ok(judge(m).reason, m.id);
});

test('form fields are pulled from "Label: value" lines', () => {
  const f = C.formFields(emails[0].body);
  assert.equal(f.name, 'Buyer D'); assert.equal(f.email, 'buyer.d@example.com'); assert.equal(f.phone, '07700 900104');
  assert.match(f.message, /Labradoodle puppies/);
  const g = C.formFields(emails[2].body);
  assert.equal(g.name, 'Buyer F Example'); assert.equal(g.message, 'Interested in a chocolate girl');
  assert.deepEqual(C.formFields(''), {});
  assert.equal(C.formFields('Message:\nOn the next line\n').message, 'On the next line');
});

test('a form sender\'s mail with no contact fields is not an enquiry', () => {
  assert.equal(judge({ from: 'wordpress@example.com', subject: 'New submission', body: 'Nothing here' }).enquiry, false);
});

test('promotions and spam labels are always skipped', () => {
  assert.equal(judge(Object.assign({}, emails[1], { labels: ['SPAM'] })).enquiry, false);
  assert.equal(judge(Object.assign({}, emails[1], { labels: ['CATEGORY_PROMOTIONS'] })).enquiry, false);
});

test('the Gmail query is narrow: business addresses or form senders, never promotions, spam or trash', () => {
  const q = C.gmailQuery({ addresses: ['site.example', 'brand.example'], formSenders: ['wordpress-site'], days: 30 });
  assert.equal(q, '{to:(site.example OR brand.example) from:(wordpress-site)} newer_than:30d -category:promotions -category:social -in:spam -in:trash');
  assert.match(C.gmailQuery({}), /newer_than:90d -category:promotions/);
});
