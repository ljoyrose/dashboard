'use strict';
/** Compliance job counts: litter jobs count only for the litters the caller passes as current. */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../cdhub/jobs-view.js');

const T = (key, target, every) => ({ id: 'cty-' + key, type_key: key, label: key, target, every_days: every, active: 'true', effective_from: '2026-01-01', sop: 'Socialisation' });
const base = { today: '2026-03-02', types: [T('socialise', 'litter', '1')], dogs: [], areas: [] };
const logs = [{ id: 'l1', check_type_id: 'cty-socialise', litter_id: 'lit1', outcome: 'ok', taken_at: '2026-03-02T09:00:00Z' }];

test('litter jobs count per current litter, and not at all with no current litters', () => {
  const one = V.summary(Object.assign({}, base, { logs, litters: [{ id: 'lit1' }, { id: 'lit2' }] }))[0];
  assert.equal(one.ok, 1);
  assert.equal(one.due, 1);
  assert.equal(V.summary(Object.assign({}, base, { logs, litters: [] })).length, 0);
  assert.equal(V.summary(Object.assign({}, base, { logs })).length, 0);
});

test('a litter\'s history lists only its own records', () => {
  const v = Object.assign({}, base, { logs: logs.concat([{ id: 'l2', check_type_id: 'cty-socialise', litter_id: 'lit2', outcome: 'ok', taken_at: '2026-03-01T09:00:00Z' }]) });
  assert.deepEqual(V.history(v, { litter_id: 'lit1' }).map((r) => r.at), ['2026-03-02T09:00:00Z']);
});

test('an isolation-only room job is counted for the isolation room and its dogs, not every room and dog', () => {
  const v = { today: '2026-03-02', logs: [], litters: [], types: [Object.assign(T('iso_checks', 'area', '1'), { only_in_areas: 'iso', site_scope: 'per_dog', sop: 'Isolation' })],
    dogs: [{ id: 'd1', area_id: 'iso' }, { id: 'd2', area_id: 'r1' }], areas: [{ id: 'iso' }, { id: 'r1' }] };
  const row = V.summary(v)[0];
  assert.equal(row.due, 1);
});

test('a whole-site job about dogs counts as done only once every dog has a line', () => {
  const types = [Object.assign(T('health', 'none', '1'), { site_scope: 'per_dog', sop: 'Health Check' })];
  const line = (dog) => ({ id: 'h-' + dog, check_type_id: 'cty-health', subject_id: dog, outcome: 'ok', how_recorded: 'site_tap', taken_at: '2026-03-02T09:00:00Z' });
  const v = (logs) => ({ today: '2026-03-02', logs, litters: [], types, dogs: [{ id: 'd1', area_id: 'r1' }, { id: 'd2', area_id: 'r1' }], areas: [{ id: 'r1' }] });
  assert.equal(V.summary(v([line('d1')]))[0].due, 1);
  assert.equal(V.summary(v([line('d1'), line('d2')]))[0].ok, 1);
});

test('the SOP card says how often each job is due, from its every_days row', () => {
  assert.equal(V.everyWords(365), 'every 12 months');
  assert.equal(V.everyWords(730), 'every 24 months');
  assert.equal(V.everyWords(14), 'every 2 weeks');
  assert.equal(V.everyWords(7), 'weekly');
  assert.equal(V.everyWords(1), 'daily');
  assert.equal(V.everyWords(10), 'every 10 days');
  assert.equal(V.everyWords(null), 'as needed');
  const v = { today: '2026-03-02', logs: [], litters: [], types: [Object.assign(T('fit_to_breed', 'dog', '365'), { sop: 'Mating and Retirement' })],
    dogs: [{ id: 'd1', area_id: 'r1' }], areas: [], esc: (s) => String(s), dmy: (s) => s };
  assert.match(V.sopHtml(v, 'Mating and Retirement'), /<b>fit_to_breed<\/b><span class="mut" data-every>every 12 months<\/span>/);
});

test('a record\'s linked file (e.g. a vet certificate) opens from the history; ended links and other records\' files do not show', () => {
  const types = [Object.assign(T('fit_to_breed', 'dog', '365'), { sop: 'Mating and Retirement' })];
  const logs = [
    { id: 'c1', check_type_id: 'cty-fit_to_breed', subject_id: 'd1', outcome: 'ok', happened_at: '2026-08-13T12:00:00Z', time_given: 'false', how_recorded: 'import' },
    { id: 'c2', check_type_id: 'cty-fit_to_breed', subject_id: 'd1', outcome: 'ok', happened_at: '2025-08-01T12:00:00Z' },
  ];
  const files = [{ id: 'f1', name: 'cert.pdf', drive_file_id: '1FAKEFILEIDFORTESTS00000000000aa' }, { id: 'f2', name: 'old.pdf', drive_file_id: '1FAKEOLDFILEIDFORTESTS000000000' }];
  const links = [
    { from_table: 'check_log', from_id: 'c1', role: 'certificate', to_table: 'files', to_id: 'f1', from_date: '2026-08-13', to_date: '' },
    { from_table: 'check_log', from_id: 'c2', role: 'certificate', to_table: 'files', to_id: 'f2', from_date: '2025-08-01', to_date: '2026-01-01' },
  ];
  const v = { today: '2026-03-02', types, logs, links, files, dogs: [], areas: [] };
  const rows = V.history(v, { subject_id: 'd1' });
  assert.deepEqual(rows.map((r) => r.at), ['2026-08-13T12:00:00Z', '2025-08-01T12:00:00Z']);
  assert.deepEqual(rows[0].files, [{ role: 'certificate', name: 'cert.pdf', url: 'https://drive.google.com/file/d/1FAKEFILEIDFORTESTS00000000000aa/view' }]);
  assert.deepEqual(rows[1].files, []);
  const html = V.historyHtml(Object.assign({ esc: (s) => String(s), dmy: (s) => s }, v), { subject_id: 'd1' }, '');
  assert.match(html, /href="https:\/\/drive\.google\.com\/file\/d\/1FAKEFILEIDFORTESTS00000000000aa\/view"[^>]*data-record-file[^>]*>certificate<\/a>/);
  // Lisa 22 Nov 2026: whether "entered later" shows is the owner's row display.entered_later; none = hidden
  assert.doesNotMatch(html, /time not given|imported|entered earlier/);
  const on = Object.assign({ esc: (s) => String(s), dmy: (s) => s }, v, { rules: [{ rule_key: 'display.entered_later', value: 'on', effective_from: '2026-01-01' }] });
  const shown = V.historyHtml(on, { subject_id: 'd1' }, '');
  assert.match(shown, /time not given/);
  assert.match(shown, /imported/);
  const off = Object.assign({}, on, { rules: [{ rule_key: 'display.entered_later', value: 'on', effective_from: '2026-01-01' }, { rule_key: 'display.entered_later', value: 'off', effective_from: '2026-02-01' }] });
  assert.doesNotMatch(V.historyHtml(off, { subject_id: 'd1' }, ''), /time not given|imported/);   // the later row wins
  // the record itself is unchanged: how_recorded and time_given are still on the row
  assert.equal(V.history(v, { subject_id: 'd1' })[0].how, 'import');
  assert.equal(V.history(v, { subject_id: 'd1' })[0].noTime, true);
});

test('a history with no links or files still draws', () => {
  const v = Object.assign({}, base, { logs });
  assert.deepEqual(V.history(v, { litter_id: 'lit1' })[0].files, []);
});

test('Compliance counts a breeding-only job for breeding dogs only', () => {
  const types = [Object.assign(T('fit_to_breed', 'dog', '365'), { only_groups: 'breeding' })];
  const links = [{ role: 'member_of', from_table: 'subject', from_id: 'd1', to_table: 'group', to_id: 'breeding', from_date: '2026-01-01', to_date: '' }];
  const v = { today: '2026-03-02', types, logs: [], links, litters: [], dogs: [{ id: 'd1', area_id: 'r1' }, { id: 'pup', area_id: 'r1' }], areas: [{ id: 'r1' }] };
  const row = V.summary(v)[0];
  assert.equal(row.due, 1);
  assert.equal(row.late, 0);
});

test('an owner note covering a past period shows once on the Jobs card, with the day it was entered (checks A, 17 Nov 2026)', () => {
  const note = 'All daily and weekly checks were done 1 Jan 2025 to 16 Nov 2026; not recorded at the time.';
  const v = Object.assign({}, base, {
    litters: [{ id: 'lit1' }], esc: (s) => String(s), dmy: (s) => s,
    logs: logs.concat([
      { id: 'n1', check_type_id: 'cty-socialise', outcome: 'ok', how_recorded: 'owner_note', note, taken_at: '2026-11-17T10:00:00Z', taken_by: 'Pat' },
      { id: 'n2', check_type_id: 'cty-socialise', outcome: 'ok', how_recorded: 'owner_note', note, taken_at: '2026-11-17T10:00:00Z', taken_by: 'Pat' },
    ]),
  });
  const html = V.complianceHtml(v, () => '');
  assert.equal(html.split('data-owner-note').length - 1, 1);
  assert.match(html, /Owner’s note: All daily and weekly checks/);
  assert.doesNotMatch(html, /entered 2026-11-17/);   // 22 Nov 2026: hidden unless the owner's row display.entered_later is on
  const on = V.complianceHtml(Object.assign({}, v, { rules: [{ rule_key: 'display.entered_later', value: 'on', effective_from: '2026-01-01' }] }), () => '');
  assert.match(on, /entered 2026-11-17 by Pat/);
});

// Lisa 17 Nov 2026 ("is that not for the app user to decide? Its their app"): the words for how a record was made are
// the owner's rows job.how.<how>.label; "off" hides them; no row = the starter words. The record keeps how_recorded.
test('how a record was made is shown in the owner\'s words, hidden with "off", starter words with no row', () => {
  const rule = (how, value, from) => ({ rule_key: 'job.how.' + how + '.label', value, effective_from: from || '2026-01-01' });
  const v = { rules: [rule('site_tap', 'All done'), rule('tapped', 'off'), rule('scanned', 'QR', '2026-12-01')] };
  assert.equal(V.howLabel(v, 'site_tap', '2026-11-17'), 'All done');
  assert.equal(V.howLabel(v, 'tapped', '2026-11-17'), '');
  assert.equal(V.howLabel(v, 'scanned', '2026-11-17'), 'opened from tag');   // its row starts later
  assert.equal(V.howLabel(v, 'scanned', '2026-12-02'), 'QR');
  assert.equal(V.howLabel({ rules: [] }, 'site_tap', '2026-11-17'), 'whole-site tap');
  assert.equal(V.howLabel(v, '', '2026-11-17'), '');
});

// 22 Nov 2026 (guardrail): the "entered later" setting lives in jobs-view.js, which only the owner hub loads. Inspector
// pages, prints, registers and exports never load it, so what they show about back-filled records cannot change with it.
test('only the owner hub loads jobs-view.js: inspector, print, temperature and register pages do not', () => {
  const fs = require('node:fs'), path = require('node:path');
  const root = path.join(__dirname, '..', '..', 'cdhub');
  const pages = [];
  (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'test') walk(p); } else if (/\.(html|js)$/.test(e.name)) pages.push(p); }); })(root);
  const users = pages.filter((p) => /jobs-view\.js/.test(fs.readFileSync(p, 'utf8')) && !/jobs-view\.js$/.test(p)).map((p) => path.relative(root, p));
  assert.deepEqual(users, ['index.html']);
});
