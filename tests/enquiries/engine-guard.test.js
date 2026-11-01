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
  [/\.forward\s*\(/, 'Gmail forward'], [/createDraft\s*\(/, 'Gmail draft (GMAIL_DRAFTS is off)'],
  [/\.moveToTrash\s*\(|\.setTrashed\s*\(/, 'trash'], [/\.addLabel\s*\(|\.removeLabel\s*\(/, 'Gmail label change'],
  [/['"](post|put|patch|delete)['"]\s*$/im, 'a write HTTP method on its own'],
  [/method\s*:\s*['"](put|patch|delete)['"]/i, 'HTTP PUT/PATCH/DELETE'],
  [/stripe|paypal|gocardless|sumup|square(up)?\.com/i, 'a payment API'],
  [/api\.xero\.com|activepieces/i, 'a Xero or Activepieces call'],
  [/\/tags?\b[^\n]*method\s*:\s*['"]post/i, 'a tag write'],
  [/\.delete(Row|Rows|Sheet|Column|Columns)\s*\(|\.clearContents|\.clear\s*\(/, 'a sheet delete or clear']
];

test('engine: no send, draft, CRM write, payment, Xero, Activepieces, tag or delete call', { skip }, () => {
  for (const [re, what] of NEVER) assert.ok(!re.test(code), 'engine must never contain ' + what);
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

test('engine: setup() creates RR_ENQUIRIES with the 12 tabs of the shared contract', { skip }, () => {
  const C = require('../../enquiries/core.js');
  assert.deepEqual(Object.keys(C.COLUMNS), ['Enquiries', 'People', 'Events', 'Drafts', 'FollowUps', 'Litters', 'Sale Replies', 'Deposits', 'Sources', 'Settings', 'Requests', 'Log']);
  assert.match(code, /function tabs_\(\) \{ return EnquiriesCore\.COLUMNS; \}/);
  assert.match(src, /var SHEET_NAME = 'RR_ENQUIRIES';/);
  assert.match(src, /function setup\(\)/);
});
