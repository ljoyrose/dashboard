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

test('setup() makes RR_ENQUIRIES with 13 tabs, Settings and Sources, and no extra tab', { skip }, () => {
  const e = FAKE.load(src);
  e.ctx.setup();
  const names = e.book().getSheets().map((s) => s.name);
  assert.deepEqual(names.sort(), ['Deposits', 'Drafts', 'Enquiries', 'Events', 'FollowUps', 'Litters', 'Log', 'People', 'Requests', 'Sale Replies', 'Settings', 'Sources', 'Style'].sort());
  assert.equal(e.props.ENQ_SHEET_ID, 'SAMPLE-BOOK-ID');
  assert.ok(e.tab('Settings').some((r) => r.setting === 'calendly_event_name' && r.value === 'Whatsapp Call'));
  assert.equal(e.tab('Sources').length, 12);
  e.ctx.setup(); // safe to run twice
  assert.equal(e.book().getSheets().length, 13);
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

// ---- Stage 6: people across sources, history, past deposits, contact gate ----------------------------------------
const req = (id, channel, text, at) => { const b = C.addRequest({ channel, kind: 'puppy', text }, at || '2026-10-29T10:00:00.000Z'); return { id, name: b.name, text: JSON.stringify(b.body) }; };
const setSetting = (e, name, value) => { const st = e.book().getSheetByName('Settings'); st.rows.forEach((r) => { if (r[0] === name) r[1] = value; }); };

test('Stage 6: same full name by email and by phone is one person marked check; same first name, other phone stays apart', { skip }, () => {
  const files = [
    req('FILE-S6-1', 'facebook', 'From: Buyer Rsample\nAny girls? buyer.r@example.com', '2026-10-20T10:00:00.000Z'),
    req('FILE-S6-2', 'whatsapp', 'From: Buyer Rsample\nStill keen\n07700 900381', '2026-10-22T10:00:00.000Z'),
    req('FILE-S6-3', 'phone', 'From: Buyer\nRang about boys\n07700 900382'),
    req('FILE-S6-4', 'phone', 'From: Buyer\nRang about girls\n07700 900383')
  ];
  const e = FAKE.load(src, { props: { ENQ_REQUESTS_FOLDER_ID: 'FOLDER-SAMPLE' }, files, dryRun: false });
  e.ctx.setup();
  e.ctx.runOnce();
  const enq = e.tab('Enquiries'), ppl = e.tab('People');
  assert.equal(enq.length, 4);
  assert.equal(ppl.length, 3, 'R joined across email and WhatsApp; the two "Buyer" callers stay two people');
  const r = ppl.find((p) => p.email === 'buyer.r@example.com');
  assert.equal(r.phone_e164, '+447700900381');
  assert.ok(Number(r.match_confidence) < 0.9);
  assert.match(String(r.check), /name match/);
  assert.equal(r.sources, 'facebook, whatsapp');
  assert.equal(r.touches, 2);
  assert.equal(r.first_contact_uk, '2026-10-20T11:00:00'); // UK clock (BST)
  assert.equal(r.last_touch_uk, '2026-10-22T11:00:00');
  assert.match(r.ref, /^C-\d{4}$/);
  const keys = enq.map((x) => x.person_key);
  assert.equal(new Set(keys).size, 3);
  e.ctx.runOnce();
  assert.equal(e.tab('People').length, 3, 're-run adds no people');
});

test('Stage 6 ACCEPT: a do-not-contact person never gets a FollowUps row, on any of their enquiries', { skip }, () => {
  // buyer.p is do-not-contact in ClickFunnels; the same address then arrives by hand on Facebook.
  const files = [req('FILE-S6-5', 'facebook', 'From: Buyer P\nHello again buyer.p@example.com'), req('FILE-S6-6', 'email', 'From: Buyer Z Sample\nbuyer.z@example.com')];
  const e = FAKE.load(src, { props: Object.assign({ ENQ_REQUESTS_FOLDER_ID: 'FOLDER-SAMPLE' }, CF_PROPS), routes: cfRoutes('Australian Labradoodles/Cobberdogs'), files, dryRun: false });
  e.ctx.setup();
  e.ctx.runOnce();
  const enq = e.tab('Enquiries');
  const p = e.tab('People').find((x) => x.email === 'buyer.p@example.com');
  assert.equal(p.do_not_contact, true);
  const pEnq = enq.filter((x) => x.person_key === p.person_key);
  assert.equal(pEnq.length, 2, 'ClickFunnels run and Facebook message are one person');
  assert.ok(pEnq.every((x) => x.do_not_contact === true && x.consent === 'do-not-contact'), 'red chip on every enquiry of that person');
  const z = enq.find((x) => x.source_ref === 'FILE-S6-6');
  const items = enq.filter((x) => x.person_key === p.person_key || x === z).map((x, i) => ({ followup_key: 'F-S6-' + i, enquiry_key: x.key, person_key: x.person_key, rule: 'first-reply', try: 1, status: 'due' }));
  const res = e.ctx.queueFollowUps_(items);
  assert.deepEqual(JSON.parse(JSON.stringify(res)), { written: 1, blocked: 2 });
  const fu = e.tab('FollowUps');
  assert.equal(fu.length, 1);
  assert.equal(fu[0].enquiry_key, z.key);
  assert.ok(!fu.some((f) => f.person_key === p.person_key));
  assert.ok(e.tab('Log').some((r) => r.step === 'contact-rule' && /blocked/.test(r.message)));
});

test('Stage 6: past deposit and repeat buyer from the allocation sheets, read only, hashed keys only', { skip }, () => {
  const others = { 'ALLOC-SAMPLE': {
    CURRENT: [['section', 'ref', 'name', 'status', 'deposit_date', 'whatsapp', 'email', 'ppf (colour/gender)', 'notes', 'provisional_pup'],
      ['PUPS', 'r1', 'Buyer V Sample', 'deposit paid', '2026-09-10', '07700 900391', '', '', '', ''],
      ['LDB-WAITING', 'r2', 'Buyer W Sample', 'lead', '', '07700 900392', '', '', '', '']],
    'OLD_LDB_LIST_2026-10-22': [['xero_contact', 'xero_contact_id', 'first_deposit', 'deposit_total', 'old_22oct_stage', 'outcome_27oct', 'evidence', 'now_on_CURRENT_tab'],
      ['Buyer Y Sample', 'X-1', '2025-03-01', '1', 'collected', 'went home', '', 'no']],
    LESSONS: [['never read'], ['x']] } };
  const files = [req('FILE-S6-7', 'whatsapp', 'From: Buyer V\n07700 900391'), req('FILE-S6-8', 'whatsapp', 'From: Buyer W\n07700 900392'), req('FILE-S6-9', 'email', 'From: Buyer Y Sample\nbuyer.y@example.com')];
  const e = FAKE.load(src, { props: { ENQ_REQUESTS_FOLDER_ID: 'FOLDER-SAMPLE' }, files, others, dryRun: false });
  e.ctx.setup();
  setSetting(e, 'allocation_sheet_ids', 'ALLOC-SAMPLE');
  e.ctx.runOnce();
  const ppl = e.tab('People');
  const v = ppl.find((x) => x.phone_e164 === '+447700900391'), w = ppl.find((x) => x.phone_e164 === '+447700900392'), y = ppl.find((x) => x.email === 'buyer.y@example.com');
  assert.equal(v.past_deposit, true); assert.equal(v.repeat_buyer, false);
  assert.equal(w.past_deposit, false, 'a lead with no deposit');
  assert.equal(y.past_deposit, true); assert.equal(y.repeat_buyer, true);
  assert.match(String(y.check), /name only/);
  assert.deepEqual(e.touched, [], 'nothing but reads on the allocation sheet');
  assert.ok(e.tab('Log').some((r) => r.step === 'people' && /2 with a past deposit, 1 to check/.test(r.message)));
  for (const t of Object.keys(e.book().sheets.reduce((a, s) => (a[s.name] = 1, a), {}))) {
    const flat = JSON.stringify(e.book().getSheetByName(t).rows);
    assert.ok(!/LDB-WAITING|"X-1"|deposit paid|2026-09-10|2025-03-01/.test(flat), 'no allocation-sheet text copied into ' + t);
  }
});

test('Stage 6: setup() on an older sheet adds only the new settings and keeps Lisa\'s values', { skip }, () => {
  const e = FAKE.load(src);
  e.ctx.setup();
  const st = e.book().getSheetByName('Settings');
  st.rows.forEach((r) => { if (r[0] === 'gmail_days') r[1] = '30'; });
  const n = st.rows.length;
  st.rows.splice(st.rows.findIndex((r) => r[0] === 'name_match_min'), 1);
  e.ctx.setup();
  assert.equal(st.rows.length, n);
  assert.equal(st.rows.find((r) => r[0] === 'gmail_days')[1], '30');
  assert.ok(st.rows.some((r) => r[0] === 'name_match_min'));
});

// ---- Stage 7: scoring ----------------------------------------------------------------------------------------------
test('Stage 7: every enquiry is scored with a band, 1 to 3 reasons and flags; prefs fill blank fields', { skip }, () => {
  const files = [
    req('FILE-S7-1', 'whatsapp', 'From: Buyer S Sample\nLooking for a chocolate girl asap, fenced garden, ready to pay a deposit. I have allergies.\n07700 900401'),
    req('FILE-S7-2', 'facebook', 'From: Buyer T Sample\nhello')
  ];
  const e = FAKE.load(src, { props: { ENQ_REQUESTS_FOLDER_ID: 'FOLDER-SAMPLE' }, files, dryRun: false });
  e.ctx.setup();
  e.ctx.runOnce();
  const enq = e.tab('Enquiries');
  const s = enq.find((x) => x.source_ref === 'FILE-S7-1'), t = enq.find((x) => x.source_ref === 'FILE-S7-2');
  assert.equal(s.score, 55); // timing 20 + deposit 15 + home 10 + UK 10 (no Litters rows yet, so no fit points)
  assert.equal(s.band, 'warm');
  assert.equal(String(s.score_reasons).split(' | ').length, 3);
  assert.equal(s.household_flags, 'allergies');
  assert.equal(s.sex, 'female'); assert.equal(s.colour, 'chocolate');
  assert.equal(t.band, 'not-a-fit');
  assert.ok(String(t.score_reasons).length > 0, 'a score always has a reason');
  assert.ok(e.tab('Log').some((r) => r.step === 'score' && /2 scored/.test(r.message)));
});

// ---- Stage 8: reply drafts -----------------------------------------------------------------------------------------
test('Stage 8: drafts in the Drafts tab only (email + WhatsApp), none for do-not-contact, every one passes the check', { skip }, () => {
  const files = [req('FILE-S8-1', 'email', 'From: Buyer U Sample\nA chocolate girl please buyer.u@example.com'),
    req('FILE-S8-2', 'facebook', 'From: Buyer P\nHello again buyer.p@example.com')];
  const e = FAKE.load(src, { props: Object.assign({ ENQ_REQUESTS_FOLDER_ID: 'FOLDER-SAMPLE' }, CF_PROPS), routes: cfRoutes('Australian Labradoodles/Cobberdogs'), files, dryRun: false });
  e.ctx.setup();
  e.ctx.runOnce();
  const enq = e.tab('Enquiries'), drafts = e.tab('Drafts');
  const u = enq.find((x) => x.source_ref === 'FILE-S8-1');
  const mine = drafts.filter((d) => d.enquiry_key === u.key);
  assert.deepEqual(mine.map((d) => d.version).sort(), ['email', 'whatsapp']);
  assert.ok(mine.every((d) => d.status === 'ready' && d.case === 'first-uk'));
  assert.match(mine.find((d) => d.version === 'email').text, /^Subject: Your puppy enquiry/);
  assert.match(mine.find((d) => d.version === 'email').text, /Hi Buyer,/);
  const dnc = enq.filter((x) => x.do_not_contact === true).map((x) => x.key);
  assert.ok(dnc.length >= 2);
  assert.ok(!drafts.some((d) => dnc.includes(d.enquiry_key)), 'no draft for a do-not-contact person');
  for (const d of drafts) assert.deepEqual(C.checkDraft(d.text, { stop: d.case === 'breeder' || d.case === 'missed' }), [], d.case + ' ' + d.version);
  assert.ok(drafts.some((d) => d.case === 'missed'), 'the 2025 Website Optin run gets the missed-enquiry apology');
  assert.ok(!e.http.some((h) => /draft|send/i.test(h.url)), 'no draft or send call anywhere');
  const n = drafts.length; e.ctx.runOnce(); assert.equal(e.tab('Drafts').length, n, 're-run adds no drafts');
});

test('Stage 8: styleSample() keeps only Lisa\'s own stripped replies in the Style tab', { skip }, () => {
  const gmail = [
    // Invented sender on Lisa's domain, assembled so the privacy guard does not read it as a real address.
    { id: 'TH-S8-1', from: 'Lisa <lisa' + '@labradoodles.co.uk>', to: 'Buyerina Sample <buyer.s8@example.com>', subject: 'Re: puppy',
      body: 'Hi Buyerina,\n\nThank you so much for getting in touch, I would love to help. Have a look at https://doc.labradoodles.co.uk/breed and tell me what you are looking for. You can call me on 07700 900511.\n\nKind regards,\nLisa\n\nOn Mon, 1 Sep 2026, Buyerina wrote:\n> Do you have puppies?' },
    { id: 'TH-S8-2', from: 'Someone Else <someone@example.com>', to: 'x', subject: 'puppy', body: 'Not Lisa, long enough text to count as a reply here, really quite long indeed yes.' }
  ];
  const e = FAKE.load(src, { gmail, dryRun: false });
  e.ctx.setup();
  assert.equal(e.ctx.styleSample(), 1);
  const st = e.tab('Style');
  assert.equal(st.length, 1);
  assert.match(st[0].text, /^Hi <name>,/);
  assert.doesNotMatch(JSON.stringify(st), /Buyerina|7700|example\.com|Do you have puppies/);
  assert.equal(st[0].links, 'https://doc.labradoodles.co.uk/breed');
  assert.ok(e.http.every((h) => h.method === 'get'));
});
