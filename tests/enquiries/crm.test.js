// ClickFunnels, HubSpot, contact rules and Add by hand (JOB 13 Stage 5). Run: node --test tests/enquiries/crm.test.js
// Invented data only (tests/fixtures/enquiries/crm.js). In these tests example.com stands for a real domain, so the
// junk check runs with testDomains: [] (in real data example.com IS a test entry and is kept out).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');
const Q = require('../../enquiries/requests.js');
const FX = require('../fixtures/enquiries/crm.js');

const OPTS = { testDomains: [] };

test('an invented HubSpot contact and an invented ClickFunnels opt-in with the same email are ONE person with two sources', () => {
  const cf = C.cfRecords(FX.runs, OPTS), hs = C.hubspotRecords(FX.hubspot, OPTS);
  const rows = [];
  for (const out of [cf, hs]) out.people.forEach((p) => rows.push({ key: p.enquiry_key, email: p.email, phone: p.phone_e164, channel: p.channel }));
  const people = C.groupPeople(rows);
  const m = people.find((p) => p.sources.includes('hubspot') && p.sources.includes('cf-website-optin'));
  assert.ok(m, 'merged person exists');
  assert.equal(m.rows.length, 2);
  assert.deepEqual(m.sources.sort(), ['cf-website-optin', 'hubspot']);
});

test('an anonymous page-view run is noise, not an enquiry', () => {
  const out = C.cfRecords(FX.runs, OPTS);
  assert.equal(out.byWorkflow['Breeding Cobberdogs'].runs, 3);
  assert.equal(out.byWorkflow['Breeding Cobberdogs'].noise, 2);
  assert.equal(out.byWorkflow['Breeding Cobberdogs'].real, 1);
  assert.equal(out.byWorkflow['Website Optin'].real, 3);
  assert.equal(out.noise, 2);
  assert.ok(!out.enquiries.some((e) => e.source_ref === 'RUN-SAMPLE-4' || e.source_ref === 'RUN-SAMPLE-5'));
  const b = out.enquiries.find((e) => e.source_ref === 'RUN-SAMPLE-6');
  assert.equal(b.channel, 'cf-breeding'); assert.equal(b.kind, 'breeding-set');
});

test('a workspace name or id mismatch stops the batch', () => {
  const want = { id: 'WS-SAMPLE', name: 'Australian Labradoodles/Cobberdogs' };
  assert.equal(C.workspaceGuard(want, { id: 'WS-SAMPLE', name: 'Australian Labradoodles/Cobberdogs' }).ok, true);
  assert.equal(C.workspaceGuard(want, { id: 'WS-SAMPLE', name: 'test Workspace ' }).ok, false);
  assert.equal(C.workspaceGuard(want, { id: 'WS-OTHER', name: 'Australian Labradoodles/Cobberdogs' }).ok, false);
  assert.equal(C.workspaceGuard({ id: 'WS-SAMPLE' }, { id: 'WS-SAMPLE', name: 'x' }).ok, false);
});

test('contact rules: do-not-contact and opted-out tags, and HubSpot opt-out, are honoured', () => {
  const out = C.cfRecords(FX.runs, OPTS);
  const n = out.enquiries.find((e) => e.source_ref === 'RUN-SAMPLE-2');
  const p = out.enquiries.find((e) => e.source_ref === 'RUN-SAMPLE-3');
  assert.equal(n.consent, 'unsubscribed'); assert.equal(n.do_not_contact, true);
  assert.equal(p.consent, 'do-not-contact'); assert.equal(p.do_not_contact, true);
  assert.equal(C.consentFrom({ tags: ['LDD-BAD-Do-Not-Market'] }).consent, 'do-not-contact');
  assert.equal(C.consentFrom({ tags: ['X-DONT-CONTACT'] }).do_not_contact, true);
  assert.equal(C.consentFrom({ tags: ['Breeder'] }).consent, 'unknown');
  const u = C.hubspotRecords(FX.hubspot, OPTS).enquiries.find((e) => e.source_ref === 'HS-SAMPLE-5');
  assert.equal(u.consent, 'unsubscribed');
});

test('HubSpot junk (random letters, dotted throwaway, no contact) is counted, not captured', () => {
  const out = C.hubspotRecords(FX.hubspot, OPTS);
  assert.equal(out.enquiries.length, 2);
  assert.equal(out.junk, 3);
  assert.deepEqual(C.junkReasons({ name: 'Buyer A', email: 'buyer.a@example.com' }, OPTS), []);
  assert.ok(C.junkReasons({ name: 'Buyer A', email: 'buyer.a@example.com' }).includes('test or throwaway domain'));
  assert.ok(C.junkReasons({ name: 'Joke', phone: '+44' + '7123456789' }).includes('dummy phone')); // assembled: the well-known dummy number
});

test('OW-0003: breeder-form runs are matched to page submissions by page and time, counts only', () => {
  const breed = FX.runs.filter((r) => r.workflow === 'Breeding Cobberdogs' && !(r.contact && r.contact.email));
  const m = C.matchSubmissions(breed, FX.submissions, 10);
  assert.equal(m.matched.length, 1);
  assert.equal(m.matched[0].run.id, 'RUN-SAMPLE-5');
  assert.equal(m.matched[0].submission.id, 'SUB-SAMPLE-1');
  assert.equal(m.unmatched.length, 1);
});

test('Add by hand: exactly one request; refuses an empty channel and text over 5,000 characters', async () => {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ id: 'FILE-SAMPLE' }) }; };
  const o = { folderId: 'FOLDER-SAMPLE', token: 'tok', fetch: f };
  const r = await Q.addByHand(o, { channel: 'whatsapp', kind: 'puppy', text: 'Hi, Buyer V here, any girls in the spring litter? 07700 900207' });
  assert.deepEqual(r, { queued: true, example: false, id: 'FILE-SAMPLE' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'POST');
  assert.match(calls[0].url, /upload\/drive\/v3\/files\?uploadType=multipart/);
  assert.match(calls[0].init.body, /"parents":\["FOLDER-SAMPLE"\]/);
  assert.match(calls[0].init.body, /"kind":"add","channel":"whatsapp"/);
  await assert.rejects(Q.addByHand(o, { channel: '', text: 'hello' }), /Pick where it came from/);
  await assert.rejects(Q.addByHand(o, { channel: 'facebook', text: 'x'.repeat(5001) }), /most is 5000/);
  await assert.rejects(Q.addByHand(o, { channel: 'tiktok', text: 'hello' }), /Unknown channel/);
  await assert.rejects(Q.addByHand(o, { channel: 'email', text: '   ' }), /Paste the message/);
  assert.equal(calls.length, 1, 'refusals send nothing');
  assert.equal(C.addRequest({ channel: 'phone', text: 'x'.repeat(5000) }).ok, true);
});

test('Add by hand in example mode (no ids yet) sends nothing', async () => {
  let n = 0;
  const r = await Q.addByHand({ fetch: async () => { n++; } }, { channel: 'email', text: 'hello puppy' });
  assert.deepEqual(r, { queued: false, example: true });
  assert.equal(n, 0);
});

test('the engine reads name, email and phone out of a pasted message', () => {
  const p = C.parsePasted('From: Buyer W\nHello, do you have a boy? Email me at buyer.w@example.com or ring 07700 900208');
  assert.equal(p.name, 'Buyer W'); assert.equal(p.email, 'buyer.w@example.com'); assert.equal(p.phone_e164, '+447700900208');
  assert.deepEqual(C.parsePasted('just a question').email, '');
});

test('every CF and HubSpot row passes the data contract', () => {
  for (const e of C.cfRecords(FX.runs, OPTS).enquiries.concat(C.hubspotRecords(FX.hubspot, OPTS).enquiries)) assert.deepEqual(C.validateRow(e), [], e.source_ref);
});
