// Runs the REAL engine file (path in ENQ_ENGINE_FILE, kept in Drive, not this repo) under node with fake Apps Script
// services and invented API answers. Run: ENQ_ENGINE_FILE=/path/Code.gs node --test tests/enquiries/engine-sim.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const FAKE = require('./support/fake-apps-script.js');
const CAL = require('../fixtures/enquiries/calendly.json');
const MAIL = require('../fixtures/enquiries/emails.js');
const CRM = require('../fixtures/enquiries/crm.js');
const C = require('../../enquiries/core.js');

const FILE = process.env.ENQ_ENGINE_FILE || '';
const src = FILE && fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const skip = src ? false : 'ENQ_ENGINE_FILE not set: engine simulation skipped';

const calendlyRoutes = () => {
  const events = [];
  for (const p of CAL.pairs) if (!events.find((e) => e.uri === p.event.uri)) events.push(p.event);
  return [
    [/\/users\/me$/, () => ({ resource: { uri: 'https://api.calendly.com/users/USER-SAMPLE' } })],
    [/\/scheduled_events\?/, () => ({ collection: events, pagination: { next_page: null } })],
    [/\/scheduled_events\/[^/]+\/invitees/, (url) => {
      const id = url.match(/scheduled_events\/([^/]+)\/invitees/)[1];
      return { collection: CAL.pairs.filter((p) => p.event.uri.endsWith('/' + id)).map((p) => p.invitee), pagination: { next_page: null } };
    }]
  ];
};

test('setup() makes RR_ENQUIRIES with 12 tabs, Settings and Sources, and no extra tab', { skip }, () => {
  const e = FAKE.load(src);
  e.ctx.setup();
  const names = e.book().getSheets().map((s) => s.name);
  assert.deepEqual(names.sort(), ['Deposits', 'Drafts', 'Enquiries', 'Events', 'FollowUps', 'Litters', 'Log', 'People', 'Requests', 'Sale Replies', 'Settings', 'Sources'].sort());
  assert.equal(e.props.ENQ_SHEET_ID, 'SAMPLE-BOOK-ID');
  assert.ok(e.tab('Settings').some((r) => r.setting === 'calendly_event_name' && r.value === 'Whatsapp Call'));
  assert.equal(e.tab('Sources').length, 12);
  e.ctx.setup(); // safe to run twice
  assert.equal(e.book().getSheets().length, 12);
  assert.ok(e.tab('Settings').length >= 10);
  const n = e.tab('Settings').length; e.ctx.setup(); assert.equal(e.tab('Settings').length, n);
});

test('DRY_RUN: a Calendly run reads everything and writes only to the Log', { skip }, () => {
  const e = FAKE.load(src, { props: { CALENDLY_TOKEN: 'test-token-not-real' }, routes: calendlyRoutes() });
  e.ctx.setup();
  e.ctx.runOnce();
  assert.equal(e.tab('Enquiries').length, 0);
  assert.equal(e.tab('Events').length, 0);
  assert.ok(e.tab('Log').some((r) => /calendly/.test(r.step) && /3 enquiries/.test(r.message)), 'log says what it would do');
  const web = e.http.filter((h) => !h.url.startsWith('gmail:'));
  assert.ok(web.length > 0 && web.every((h) => h.method === 'get'), 'Calendly is read with GET only');
  assert.ok(web.every((h) => h.headers.Authorization === 'Bearer test-token-not-real'));
});

test('live run: one Enquiries row per booking chain, three Events for book-reschedule-cancel, re-run adds nothing', { skip }, () => {
  const e = FAKE.load(src, { props: { CALENDLY_TOKEN: 'test-token-not-real' }, routes: calendlyRoutes(), dryRun: false });
  e.ctx.setup();
  e.ctx.runOnce();
  const enq = e.tab('Enquiries');
  assert.equal(enq.length, 3);
  const a = enq.find((r) => r.source_ref === 'INV-SAMPLE-1');
  assert.equal(a.country_basis, 'inferred');
  assert.equal(e.tab('Events').filter((r) => r.enquiry_key === a.key).length, 3);
  assert.ok(a.person_key.startsWith('P-'));
  assert.equal(e.tab('People').length, 3);
  e.ctx.runOnce();
  assert.equal(e.tab('Enquiries').length, 3);
  assert.equal(e.tab('Events').length, 6);
  assert.equal(e.tab('People').length, 3);
  assert.equal(e.tab('Sources').find((r) => r.source === 'calendly').last_count, 3);
});

test('no Calendly key: the reader is skipped with a warning, nothing is fetched', { skip }, () => {
  const e = FAKE.load(src, { routes: [] });
  e.ctx.setup();
  e.ctx.runOnce();
  assert.equal(e.http.filter((h) => !h.url.startsWith('gmail:')).length, 0);
  assert.ok(e.tab('Log').some((r) => r.level === 'WARN' && /CALENDLY_TOKEN not set/.test(r.message)));
});

test('a POST to anything but a listed read-only search is refused', { skip }, () => {
  const e = FAKE.load(src, { routes: [[/./, () => ({})]] });
  assert.throws(() => e.ctx.fetchJson_('https://api.calendly.com/scheduled_events', 'Bearer x', { a: 1 }), /POST refused/);
  assert.equal(e.http.length, 0);
});

test('Gmail: the 12 invented emails give 6 enquiries, thread ids only, no body kept', { skip }, () => {
  const gmail = MAIL.emails.map((m, i) => Object.assign({}, m, { id: 'THREAD-SAMPLE-' + i }));
  const e = FAKE.load(src, { gmail, dryRun: false });
  e.ctx.setup();
  // the invented senders stand in for the real ones in Settings
  const st = e.book().getSheetByName('Settings');
  st.rows.forEach((r) => { if (r[0] === 'form_senders') r[1] = MAIL.FORM_SENDERS.join(', '); if (r[0] === 'noise_senders') r[1] = MAIL.NOISE_SENDERS.join(', '); });
  e.ctx.readGmail_();
  const enq = e.tab('Enquiries');
  assert.equal(enq.length, 6);
  assert.ok(enq.every((r) => /^THREAD-SAMPLE-\d+$/.test(r.source_ref)));
  assert.ok(enq.every((r) => String(r.question_summary).length <= 300));
  assert.ok(e.tab('Log').some((r) => r.step === 'gmail' && /6 enquiries/.test(r.message) && /6 noise/.test(r.message)));
  const q = e.http.find((h) => h.url.startsWith('gmail:search'));
  assert.match(q.url, /-category:promotions/);
  assert.ok(e.tab('People').some((p) => p.email === 'buyer.d@example.com' && p.phone_e164 === '+447700900104'));
});

const CF_PROPS = { CF_TOKEN: 'test-token-not-real', CF_SUBDOMAIN: 'sample', CF_WORKSPACE_ID: 'WS-SAMPLE', CF_WORKSPACE_NAME: 'Australian Labradoodles/Cobberdogs' };
const cfRoutes = (liveName) => [
  [/\/workspaces\/WS-SAMPLE\/workflows/, () => ({ data: [{ id: 'WF-1', name: 'Website Optin' }, { id: 'WF-2', name: 'Breeding Cobberdogs' }, { id: 'WF-3', name: 'Something else' }] })],
  [/\/workspaces\/WS-SAMPLE(\?|$)/, () => ({ id: 'WS-SAMPLE', name: liveName })],
  [/\/workflows\/WF-1\/runs/, () => ({ data: CRM.runs.filter((r) => r.workflow === 'Website Optin').map((r) => ({ id: r.id, created_at: r.created_at, contact_id: r.contact && r.contact.id })) })],
  [/\/workflows\/WF-2\/runs/, () => ({ data: CRM.runs.filter((r) => r.workflow === 'Breeding Cobberdogs').map((r) => ({ id: r.id, created_at: r.created_at, contact_id: r.contact && r.contact.id })) })],
  [/\/contacts\/[^/]+\/applied_tags/, (url) => { const id = url.match(/contacts\/([^/]+)\/applied/)[1]; const c = CRM.runs.map((r) => r.contact).find((k) => k && k.id === id); return { data: ((c && c.tags) || []).map((n) => ({ tag: { name: n } })) }; }],
  [/\/contacts\/[^/?]+/, (url) => { const id = url.match(/contacts\/([^/?]+)/)[1]; const c = CRM.runs.map((r) => r.contact).find((k) => k && k.id === id) || {}; return { id, email_address: c.email || null, phone_number: c.phone || null, first_name: c.first_name, last_name: c.last_name }; }]
];

test('ClickFunnels: guard passes, anonymous runs are noise, do-not-contact tags are honoured, GET only', { skip }, () => {
  const e = FAKE.load(src, { props: CF_PROPS, routes: cfRoutes('Australian Labradoodles/Cobberdogs'), dryRun: false });
  e.ctx.setup();
  e.ctx.readClickFunnels_();
  const enq = e.tab('Enquiries');
  assert.equal(enq.length, 4);   // 3 Website Optin + 1 real breeder form (example.com counts as junk-flagged, still captured)
  assert.ok(e.tab('Log').some((r) => /"Breeding Cobberdogs": 3 runs, 1 enquiries, 2 anonymous page views/.test(r.message)));
  assert.ok(e.tab('Log').some((r) => /"Website Optin": 3 runs, 3 enquiries/.test(r.message)));
  assert.equal(enq.find((r) => r.source_ref === 'RUN-SAMPLE-3').consent, 'do-not-contact');
  assert.ok(e.http.every((h) => h.method === 'get'));
  assert.ok(!e.http.some((h) => /tags/.test(h.url) && h.method !== 'get'));
});

test('ClickFunnels: a workspace name mismatch stops the batch before any contact is read', { skip }, () => {
  const e = FAKE.load(src, { props: CF_PROPS, routes: cfRoutes('test Workspace '), dryRun: false });
  e.ctx.setup();
  e.ctx.runOnce();
  assert.equal(e.tab('Enquiries').length, 0);
  assert.ok(e.tab('Log').some((r) => r.level === 'ERROR' && /workspace guard: workspace name does not match/.test(r.message)));
  assert.ok(!e.http.some((h) => /\/contacts\/|\/workflows/.test(h.url)));
});

test('HubSpot: read with the listed search POST only; junk kept out', { skip }, () => {
  const e = FAKE.load(src, { props: { HUBSPOT_TOKEN: 'test-token-not-real' }, routes: [[/api\.hubapi\.com\/crm\/v3\/objects\/contacts\/search$/, () => ({ results: CRM.hubspot, paging: null })]], dryRun: false });
  e.ctx.setup();
  e.ctx.readHubSpot_();
  // in the engine example.com is junk (a test domain), so only invented contacts on it are all kept out
  assert.ok(e.tab('Log').some((r) => r.step === 'hubspot' && /5 contacts read/.test(r.message) && /junk kept out/.test(r.message)));
  assert.ok(e.http.every((h) => /contacts\/search$/.test(h.url) && h.method === 'post'));
});

test('Add by hand: one request file becomes one row and one Requests line; read once only', { skip }, () => {
  const built = C.addRequest({ channel: 'facebook', kind: 'puppy', text: 'From: Buyer X\nAny boys due? buyer.x@example.com 07700 900209' }, '2026-10-29T10:00:00.000Z');
  const files = [{ id: 'FILE-SAMPLE-1', name: built.name, text: JSON.stringify(built.body) }, { id: 'FILE-SAMPLE-2', name: 'ENQ-bad.json', text: 'not json' }];
  const e = FAKE.load(src, { props: { ENQ_REQUESTS_FOLDER_ID: 'FOLDER-SAMPLE' }, files, dryRun: false });
  e.ctx.setup();
  e.ctx.readRequests_();
  const enq = e.tab('Enquiries');
  assert.equal(enq.length, 1);
  assert.equal(enq[0].channel, 'facebook'); assert.equal(enq[0].source, 'Added by hand');
  assert.equal(e.tab('Requests').length, 2);
  assert.ok(e.tab('People').some((p) => p.email === 'buyer.x@example.com' && p.phone_e164 === '+447700900209'));
});
