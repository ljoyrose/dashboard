// Data contract for RR_ENQUIRIES (JOB 13 Stage 2). Run: node --test tests/enquiries/contract.test.js
// Invented rows only (tests/fixtures/enquiries/rows.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');
const R = require('../../enquiries/reader.js');
const F = require('../fixtures/enquiries/rows.js');

const REQUIRED = ['key', 'person_key', 'source', 'source_ref', 'received_uk', 'channel', 'kind', 'brand', 'country',
  'country_basis', 'breed_interest', 'size', 'colour', 'coat', 'sex', 'timing', 'household_flags', 'question_summary',
  'score', 'band', 'stage', 'next_step', 'next_due_uk', 'owner', 'do_not_contact', 'consent', 'litter_ref', 'pup_ref',
  'lost_reason', 'flag'];

test('contract: the Enquiries tab carries every column the job names, in order', () => {
  assert.deepEqual(C.COLUMNS.Enquiries.slice(0, REQUIRED.length), REQUIRED);
  assert.deepEqual(Object.keys(C.COLUMNS), ['Enquiries', 'People', 'Events', 'Drafts', 'FollowUps', 'Litters', 'Sale Replies', 'Deposits', 'Sources', 'Settings', 'Requests', 'Log', 'Style']);
});

test('contract: the word lists are exactly the job\'s lists', () => {
  assert.deepEqual(C.CHANNELS, ['email', 'calendly', 'web-form', 'cf-website-optin', 'cf-breeding', 'cf-waiting-list', 'hubspot', 'hubspot-legacy', 'pets4homes', 'whatsapp', 'facebook', 'instagram', 'phone', 'manual']);
  assert.deepEqual(C.KINDS, ['stud', 'breeding-set', 'adult-dog', 'food', 'puppy', 'other']);
  assert.deepEqual(C.BANDS, ['hot', 'warm', 'cool', 'not-a-fit']);
  assert.deepEqual(C.STAGES, ['new', 'replied', 'call-booked', 'call-held', 'offered', 'deposit', 'balance', 'collected', 'lost', 'parked']);
  assert.deepEqual(C.ADULT_STAGES, ['asked', 'details-sent', 'viewing', 'agreed', 'handed-over']);
  assert.deepEqual(C.CONSENT, ['ok', 'do-not-contact', 'unsubscribed', 'unknown']);
});

test('contract: the invented fixture parses clean', () => {
  const p = C.parseTab('Enquiries', F.enquiriesValues());
  assert.equal(p.ok, true, p.problems.join('; '));
  assert.equal(p.rows.length, F.enquiries.length);
  for (const r of p.rows) assert.deepEqual(r._problems, [], r.ref + ': ' + r._problems.join('; '));
  assert.equal(p.rows[0]._row, 2);
});

test('contract FAILS CLOSED when a required column is missing', () => {
  for (const col of REQUIRED) {
    const v = F.enquiriesValues();
    const i = v[0].indexOf(col);
    v.forEach((r) => r.splice(i, 1));
    const p = C.parseTab('Enquiries', v);
    assert.equal(p.ok, false, 'missing ' + col + ' must fail');
    assert.equal(p.rows.length, 0, 'no rows when ' + col + ' is missing');
    assert.match(p.problems.join(' '), new RegExp('"' + col + '" is missing or renamed'));
  }
});

test('contract FAILS CLOSED when a column is renamed or moved', () => {
  const v = F.enquiriesValues();
  v[0][v[0].indexOf('stage')] = 'Stage ';
  let p = C.parseTab('Enquiries', v);
  assert.equal(p.ok, false); assert.equal(p.rows.length, 0);
  const w = F.enquiriesValues();
  [w[0][1], w[0][2]] = [w[0][2], w[0][1]];
  p = C.parseTab('Enquiries', w);
  assert.equal(p.ok, false); assert.match(p.problems.join(' '), /has moved/);
  assert.equal(C.parseTab('Enquiries', []).ok, false);
  assert.equal(C.parseTab('Nope', F.enquiriesValues()).ok, false);
});

test('contract: a stage word outside the list is caught on the row', () => {
  const v = F.enquiriesValues();
  v[1][v[0].indexOf('stage')] = 'sold';
  v[2][v[0].indexOf('channel')] = 'tiktok';
  v[3][v[0].indexOf('band')] = 'scorching';
  const p = C.parseTab('Enquiries', v);
  assert.equal(p.ok, true);
  assert.match(p.rows[0]._problems.join(' '), /stage "sold" is not one of the allowed words/);
  assert.match(p.rows[1]._problems.join(' '), /channel "tiktok"/);
  assert.match(p.rows[2]._problems.join(' '), /band "scorching"/);
  const blank = F.enquiriesValues(); blank[1][blank[0].indexOf('stage')] = '';
  assert.match(C.parseTab('Enquiries', blank).rows[0]._problems.join(' '), /stage is blank/);
});

test('stage flow: offered or collected without passing deposit raises a flag', () => {
  assert.deepEqual(C.stageFlags({ stage: 'offered' }, ['new', 'replied', 'call-held']), ['no-deposit-before-offered']);
  assert.deepEqual(C.stageFlags({ stage: 'collected' }, ['new', 'offered']), ['no-deposit-before-collected']);
  assert.deepEqual(C.stageFlags({ stage: 'balance' }, []), ['no-deposit-before-balance']);
  assert.deepEqual(C.stageFlags({ stage: 'offered' }, ['new', 'deposit']), []);
  assert.deepEqual(C.stageFlags({ stage: 'collected', deposit_date: '2026-09-01' }, []), []);
  assert.deepEqual(C.stageFlags({ stage: 'call-held' }, []), []);
  assert.deepEqual(C.stageFlags({ stage: 'new', do_not_contact: 'TRUE', consent: 'ok' }, []), ['consent-conflict']);
});

test('stage flow: deposit comes before offered, so a row can move deposit -> offered', () => {
  assert.equal(C.mergeRow({ stage: 'deposit' }, { stage: 'offered' }).stage, 'offered');
  assert.equal(C.mergeRow({ stage: 'offered' }, { stage: 'deposit' }).stage, 'offered');
});

test('reader: one batchGet, read only, every tab parsed, Enquiries contract break fails the load', async () => {
  const calls = [];
  const fake = (good) => async (url, init) => {
    calls.push({ url, init });
    const valueRanges = R.TABS.map((t) => ({ values: t === 'Enquiries' ? (good ? F.enquiriesValues() : [['key', 'oops']]) : t === 'People' ? F.peopleValues() : [C.COLUMNS[t]] }));
    return { ok: true, status: 200, json: async () => ({ valueRanges }) };
  };
  const a = await R.load({ sheetId: 'SAMPLE-SHEET', token: 'tok', fetch: fake(true) });
  assert.equal(a.ok, true);
  assert.equal(a.tabs.Enquiries.rows.length, 5);
  assert.equal(a.tabs.People.rows.length, 2);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /values:batchGet\?/);
  assert.ok(!calls[0].init.method || calls[0].init.method === 'GET');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  const b = await R.load({ sheetId: 'SAMPLE-SHEET', token: 'tok', fetch: fake(false) });
  assert.equal(b.ok, false);
  assert.equal(b.tabs.Enquiries.rows.length, 0);
  assert.ok(b.problems.length > 0);
});

test('reader: not set up or not signed in sends nothing', async () => {
  let n = 0; const f = async () => { n++; };
  assert.equal((await R.load({ token: 't', fetch: f })).ok, false);
  assert.equal((await R.load({ sheetId: 'SAMPLE', fetch: f })).ok, false);
  assert.equal(n, 0);
});

test('reader: Google errors come back in plain words', async () => {
  const f = async () => ({ ok: false, status: 403, json: async () => ({ error: { message: 'The caller does not have permission' } }) });
  await assert.rejects(R.load({ sheetId: 'SAMPLE', token: 't', fetch: f }), /cannot open the RR_ENQUIRIES sheet/);
  assert.match(R.why(400, 'Unable to parse range: Drafts'), /missing a tab/);
});

test('reader.js never writes', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../enquiries/reader.js'), 'utf8');
  assert.ok(!/method\s*:\s*['"](POST|PUT|PATCH|DELETE)/i.test(src));
  assert.ok(!/:append|:batchUpdate|:clear/.test(src));
});
