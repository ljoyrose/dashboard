// Engine guard for the Puppy Enquiries engine (AA_PUPPY-ENQUIRIES-ENGINE_*_Code.gs). The engine lives in Drive
// (00 AI Commons > CHANGES), not in this public repo, so this test reads it from the path in ENQ_ENGINE_FILE.
// Run: ENQ_ENGINE_FILE=/path/to/Code.gs node --test tests/enquiries/engine-guard.test.js
// Without ENQ_ENGINE_FILE the engine checks are skipped (and say so); the core.js checks always run.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FILE = process.env.ENQ_ENGINE_FILE || '';
const src = FILE && fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const skip = src ? false : 'ENQ_ENGINE_FILE not set: engine checks skipped';
// Comments may name forbidden calls (to say they are never made); only code counts.
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');

const NEVER = [
  [/GmailApp\s*\.\s*sendEmail/, 'GmailApp.sendEmail'], [/\bMailApp\b/, 'MailApp'], [/\.reply(All)?\s*\(/, 'Gmail reply'],
  [/\.forward\s*\(/, 'Gmail forward'],
  [/\.moveToTrash\s*\(|\.setTrashed\s*\(/, 'trash'], [/\.addLabel\s*\(|\.removeLabel\s*\(/, 'Gmail label change'],
  [/['"](post|put|patch|delete)['"]\s*$/im, 'a write HTTP method on its own'],
  [/method\s*:\s*['"](put|patch|delete)['"]/i, 'HTTP PUT/PATCH/DELETE'],
  [/api\.(stripe|paypal|gocardless|sumup)\.com|connect\.squareup\.com|api\.squareup\.com/i, 'a payment API'],
  [/api\.xero\.com|activepieces/i, 'a Xero or Activepieces call'],
  [/\/tags?\b[^\n]*method\s*:\s*['"]post/i, 'a tag write'],
  [/\.delete(Row|Rows|Sheet|Column|Columns)\s*\(|\.clearContents|\.clear\s*\(/, 'a sheet delete or clear']
];

test('engine: no send, draft, CRM write, payment, Xero, Activepieces, tag or delete call', { skip }, () => {
  for (const [re, what] of NEVER) assert.ok(!re.test(code), 'engine must never contain ' + what);
});

test('engine: a Gmail draft is made only inside an if (GMAIL_DRAFTS) block, and GMAIL_DRAFTS is false', { skip }, () => {
  const lines = code.split('\n');
  const at = lines.map((l, i) => (/createDraft\s*\(/.test(l) ? i : -1)).filter((i) => i >= 0);
  assert.ok(at.length <= 1, 'createDraft in one place only');
  for (const i of at) {
    let depth = 0, ok = false;
    for (let j = i - 1; j >= 0; j--) {
      depth += (lines[j].match(/\}/g) || []).length - (lines[j].match(/\{/g) || []).length;
      if (depth < 0) { ok = /if \(GMAIL_DRAFTS\) \{\s*$/.test(lines[j]); break; }
    }
    assert.ok(ok, 'createDraft outside if (GMAIL_DRAFTS): line ' + (i + 1));
  }
  assert.match(code, /var GMAIL_DRAFTS = false;/);
});

test('engine: DRY_RUN starts true and GMAIL_DRAFTS starts false', { skip }, () => {
  assert.match(code, /var DRY_RUN = true;/);
  assert.match(code, /var GMAIL_DRAFTS = false;/);
});

test('engine: every sheet write is marked own-sheet (RR_ENQUIRIES only)', { skip }, () => {
  const lines = src.split('\n').filter((l) => /\.setValues?\(|\.appendRow\(|\.insertSheet\(|\.deleteSheet\(|\.moveTo\(|\.setFrozenRows\(/.test(l));
  assert.ok(lines.length > 0);
  for (const l of lines) assert.match(l, /own-sheet/, 'unmarked write: ' + l.trim().slice(0, 80));
});

test('engine: HTTP goes through one read helper, and only GET (or a listed read-only POST search)', { skip }, () => {
  const calls = code.match(/UrlFetchApp\.fetch(All)?\s*\(/g) || [];
  assert.ok(calls.length <= 1, 'UrlFetchApp must be called in one place only, found ' + calls.length);
  const posts = code.match(/method\s*:\s*['"]post['"]/gi) || [];
  for (const m of posts) assert.ok(/READ_ONLY_POST/.test(code), 'a POST needs the READ_ONLY_POST allow-list: ' + m);
});

test('engine: no key, token or id written in the code', { skip }, () => {
  assert.ok(!/(Bearer|token|key)\s*[:=]\s*['"][A-Za-z0-9_\-.]{16,}['"]/i.test(code), 'a literal key or token');
  assert.ok(!/(?<![A-Za-z0-9_-])1[A-Za-z0-9_-]{32,43}(?![A-Za-z0-9_-])/.test(code), 'a literal Drive id');
  assert.ok(!/@(gmail|me|icloud|hotmail|outlook|yahoo)\.com/i.test(code), 'a personal email address');
});

test('engine: embeds the current core.js under its version header', { skip }, () => {
  const core = fs.readFileSync(path.join(__dirname, '../../enquiries/core.js'), 'utf8');
  const ver = core.match(/enquiries-core [0-9.]+ \([0-9-]+\)/)[0];
  assert.ok(src.includes('==== EMBEDDED COPY: ' + ver), 'engine embeds ' + ver);
  assert.ok(src.includes(core.trim()), 'embedded copy matches enquiries/core.js exactly');
});

test('engine: setup() creates RR_ENQUIRIES with the 14 tabs of the shared contract', { skip }, () => {
  const C = require('../../enquiries/core.js');
  assert.deepEqual(Object.keys(C.COLUMNS), ['Enquiries', 'People', 'Events', 'Drafts', 'FollowUps', 'Litters', 'Sale Replies', 'Deposits', 'Sources', 'Settings', 'Requests', 'Log', 'Style', 'Results']);
  assert.match(code, /function tabs_\(\) \{ return EnquiriesCore\.COLUMNS; \}/);
  assert.match(src, /var SHEET_NAME = 'RR_ENQUIRIES';/);
  assert.match(src, /function setup\(\)/);
});

test('engine: other spreadsheets (allocation sheets, Sale sheet) are opened in one place and only read', { skip }, () => {
  const m = code.match(/function readOtherBook_\([\s\S]*?\n\}/);
  assert.ok(m, 'readOtherBook_ exists');
  assert.ok(!/\.set[A-Z]\w*\(|\.append|\.insert|\.delete|\.clear|\.moveTo|\.copyTo|\.sort\(|\.protect/.test(m[0]), 'no write call on another book');
  const opens = code.match(/SpreadsheetApp\.openById\(/g) || [];
  assert.equal(opens.length, 3, 'openById only in book_(), setup() and readOtherBook_()');
  for (const fn of ['depositKeys_', 'litters_', 'saleReplies_']) {
    const body = code.match(new RegExp('function ' + fn + '\\([\\s\\S]*?\\n\\}'))[0];
    assert.ok(!/SpreadsheetApp/.test(body), fn + ' goes through readOtherBook_');
  }
});

test('engine: FollowUps is written in one place, behind the contact gate', { skip }, () => {
  const writes = code.match(/upsert_\(\s*'FollowUps'|appendRows_\(\s*'FollowUps'|writeRow_\(\s*'FollowUps'/g) || [];
  assert.equal(writes.length, 1);
  const q = code.match(/function queueFollowUps_\([\s\S]*?\n\}/)[0];
  assert.match(q, /EnquiriesCore\.gateContact\(/);
  assert.match(q, /upsert_\('FollowUps', 'followup_key', g\.keep\)/);
});

test('engine: the Drafts tab is written in one place, behind the contact gate and the draft check', { skip }, () => {
  const writes = code.match(/upsert_\(\s*'Drafts'|appendRows_\(\s*'Drafts'|writeRow_\(\s*'Drafts'/g) || [];
  assert.equal(writes.length, 1);
  const w = code.match(/function writeDrafts_\([\s\S]*?\n\}/)[0];
  assert.match(w, /EnquiriesCore\.gateContact\(/);
  assert.match(w, /EnquiriesCore\.checkDraft\(/);
});
