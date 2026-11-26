'use strict';
/** Compliance job counts: litter jobs count only for the litters the caller passes as current; every job in force is listed. */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../cdhub/jobs-view.js');

const T = (key, target, every) => ({ id: 'cty-' + key, type_key: key, label: key, target, every_days: every, active: 'true', effective_from: '2026-01-01', sop: 'Socialisation' });
const base = { today: '2026-03-02', types: [T('socialise', 'litter', '1')], dogs: [], areas: [] };
const logs = [{ id: 'l1', check_type_id: 'cty-socialise', litter_id: 'lit1', outcome: 'ok', taken_at: '2026-03-02T09:00:00Z' }];

test('litter jobs count per current litter; with no current litter the job is still listed, nothing counted, last record kept', () => {
  const one = V.summary(Object.assign({}, base, { logs, litters: [{ id: 'lit1' }, { id: 'lit2' }] }))[0];
  assert.equal(one.ok, 1);
  assert.equal(one.due, 1);
  for (const v of [Object.assign({}, base, { logs, litters: [] }), Object.assign({}, base, { logs })]) {
    const r = V.summary(v);
    assert.equal(r.length, 1);
    assert.deepEqual([r[0].late, r[0].due, r[0].ok, r[0].none_now, r[0].last_done], [0, 0, 0, 'no_litter', '2026-03-02']);
  }
  const html = V.complianceHtml(Object.assign({}, base, { logs: [], esc: (s) => String(s), dmy: (s) => s, fold: () => '' }), () => '');
  assert.match(html, /data-job="socialise"[\s\S]*no litter now/);
});

test('a Problem-button job (target optional) shows on its SOP panel with its own timing words', () => {
  const types = [Object.assign(T('lost_dog', 'optional', ''), { sop: 'Lost Dog', frequency: 'When it happens' })];
  const v = { today: '2026-03-02', logs: [], litters: [], types, dogs: [], areas: [], esc: (s) => String(s), dmy: (s) => s };
  assert.match(V.sopHtml(v, 'Lost Dog'), /<b>lost_dog<\/b><span class="mut" data-every>When it happens<\/span>[\s\S]*Problem button/);
});

test('the summary uses each age band and the highest count for food bowls', () => {
  const types = [
    Object.assign(T('feeding', 'dog', '1'), { sop: 'checks' }),
    Object.assign(T('food_bowls', 'none', '1'), { sop: 'checks', site_scope: 'one_line' }),
    Object.assign(T('water_bowls', 'none', '1'), { sop: 'checks', site_scope: 'one_line' })
  ];
  const rules = [
    { rule_key: 'job.times_per_day.feeding', value: '2', effective_from: '2026-01-01' },
    { rule_key: 'job.times_per_day.feeding.by_age', value: '0-10:4|11-:2', effective_from: '2026-01-01' }
  ];
  const day = '2026-03-11';
  const line = (id, key, hh, subject) => ({ id: id, check_type_id: 'cty-' + key, subject_id: subject || '', outcome: 'ok', taken_at: day + 'T' + hh + ':00:00Z' });
  const logs = [
    line('fy1', 'feeding', '08', 'sub-test-a'), line('fy2', 'feeding', '12', 'sub-test-a'),
    line('fa1', 'feeding', '08', 'sub-test-b'), line('fa2', 'feeding', '12', 'sub-test-b'),
    line('b1', 'food_bowls', '08'), line('b2', 'food_bowls', '12'),
    line('w1', 'water_bowls', '08')
  ];
  const dogs = [{ id: 'sub-test-a', dob: '2026-03-01', area_id: 'area-a' }, { id: 'sub-test-b', dob: '2020-01-01', area_id: 'area-a' }];
  const rows = V.summary({ today: day, logs: logs, litters: [], types: types, dogs: dogs, areas: [], rules: rules, esc: (s) => String(s) });
  const row = (k) => rows.find((r) => r.key === k);
  assert.equal(row('feeding').due, 1);
  assert.equal(row('feeding').ok, 1);
  assert.equal(row('food_bowls').due, 1);
  assert.equal(row('water_bowls').ok, 1);
});

test('the row\'s own frequency words win over words made from every_days', () => {
  const types = [Object.assign(T('water_bowls', 'area', '1'), { sop: 'Feeding', frequency: 'Daily and when dirty' })];
  const v = { today: '2026-03-02', logs: [], litters: [], types, dogs: [], areas: [{ id: 'r1' }], esc: (s) => String(s), dmy: (s) => s };
  assert.match(V.sopHtml(v, 'Feeding'), /data-every>Daily and when dirty</);
  assert.equal(V.timing({ every_days: 7 }), 'weekly');
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
  // the owner 22 Nov 2026: whether "entered later" shows is the owner's row display.entered_later; none = hidden
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

// the owner 17 Nov 2026 ("is that not for the app user to decide? Its their app"): the words for how a record was made are
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
const NOW = '2026-11-25T12:00:00.000Z';
const esc = (s) => String(s == null ? '' : s);
const world = (type, extra) => Object.assign({
  today: '2026-11-25', logs: [], links: [], rules: [], visits: [], esc, dmy: (s) => s,
  dogs: [{ id: 'd1', name: 'Ada', area_id: 'r1' }, { id: 'd2', name: 'Bea', area_id: 'r1' }],
  areas: [{ id: 'r1', code: 'H1' }, { id: 'r2', code: 'H2' }],
  litters: [{ id: 'lit1', name: 'Litter of Ada', born_on: '2026-10-01' }],
  types: [type],
}, extra || {});
const job = (key, extra) => Object.assign({ id: 'cty-' + key, type_key: key, label: key, target: 'dog', active: 'true', effective_from: '2026-01-01', sop: 'Microchip Audit', every_days: '365' }, extra || {});

test('every SOP check that is due or not recorded has a record path', () => {
  const shapes = [
    ['dog', { target: 'dog' }],
    ['area', { target: 'area', every_days: '1' }],
    ['area-per-dog', { target: 'area', site_scope: 'per_dog', every_days: '1' }],
    ['site', { target: 'none', site_scope: 'one_line', every_days: '1' }],
    ['site-per-dog', { target: 'none', site_scope: 'per_dog', every_days: '1' }],
    ['litter', { target: 'litter', every_days: '' }],
    ['optional', { target: 'optional', every_days: '' }],
    ['either', { target: 'either', every_days: '1' }],
  ];
  shapes.forEach((pair) => {
    const html = V.sopHtml(world(job(pair[0], pair[1])), 'Microchip Audit');
    assert.match(html, /data-sop-save="/, pair[0] + ' is a dead end');
    assert.doesNotMatch(html, /time_given|how_recorded":"bulk"/, pair[0]);
  });
});

test('a dog job lists every due dog, ticked, with Mark all; an untick is left out of the save', () => {
  const v = world(job('microchip_check', { label: 'Microchip checked' }));
  const html = V.sopHtml(v, 'Microchip Audit');
  assert.match(html, /Mark all due as done today/);
  assert.match(html, /data-sop-tick="microchip_check"[^>]*value="d1"[^>]*checked/);
  assert.match(html, /value="d2"[^>]*checked/);
  const all = V.savePlans(v, 'microchip_check', [{ kind: 'dog', id: 'd1' }, { kind: 'dog', id: 'd2' }], {}, NOW);
  assert.equal(all.plans.length, 2);
  assert.equal(all.plans[0].action, 'add');
  assert.equal(all.plans[0].fields.subject_id, 'd1');
  assert.equal(all.plans[0].fields.how_recorded, 'tapped');
  assert.equal(all.plans[0].fields.happened_at, NOW);
  assert.equal(all.plans[0].fields.litter_id, undefined);
  assert.equal('time_given' in all.plans[0].fields, false);
  assert.equal(all.plans[0].fields.how_recorded === 'bulk', false);
  const one = V.savePlans(v, 'microchip_check', [{ kind: 'dog', id: 'd2' }], {}, NOW);
  assert.deepEqual(one.plans.map((p) => p.fields.subject_id), ['d2']);
});

test('a dog already done today is not ticked again, and an earlier day can still be recorded', () => {
  const v = world(job('microchip_check'), { logs: [{ id: 'l1', check_type_id: 'cty-microchip_check', subject_id: 'd1', outcome: 'ok', happened_at: '2026-11-25T09:00:00Z' }, { id: 'l2', check_type_id: 'cty-microchip_check', subject_id: 'd2', outcome: 'ok', happened_at: '2026-11-25T09:00:00Z' }] });
  const html = V.sopHtml(v, 'Microchip Audit');
  assert.match(html, /data-sop-day="microchip_check"/);
  assert.match(html, /data-sop-save="microchip_check"/);
  assert.doesNotMatch(html, /data-sop-tick="microchip_check"[^>]*checked/);
});

test('a litter check saves litter_id and no subject_id', () => {
  const v = world(job('pup_microchip', { target: 'litter', every_days: '', label: 'Puppy microchips checked' }));
  const html = V.sopHtml(v, 'Microchip Audit');
  assert.match(html, /data-one-kind="litter"/);
  assert.match(html, /data-one-id="lit1"/);
  assert.match(html, />Record</);
  const plan = V.savePlans(v, 'pup_microchip', [{ kind: 'litter', id: 'lit1' }], {}, NOW);
  assert.equal(plan.plans[0].action, 'add');
  assert.equal(plan.plans[0].fields.litter_id, 'lit1');
  assert.equal(plan.plans[0].fields.subject_id, undefined);
  assert.equal(plan.plans[0].fields.how_recorded, 'tapped');
  assert.equal(plan.plans[0].fields.happened_at, NOW);
});

test('a whole-site job about dogs is one site tap at the real time, not a paper catch-up', () => {
  const v = world(job('health', { target: 'none', site_scope: 'per_dog', every_days: '1', sop: 'Health Check' }));
  const plan = V.savePlans(v, 'health', [{ kind: 'dog', id: 'd1' }, { kind: 'dog', id: 'd2' }], {}, NOW);
  assert.equal(plan.plans.length, 1);
  assert.equal(plan.plans[0].action, 'add_site');
  assert.equal(plan.plans[0].fields.how_recorded, 'site_tap');
  assert.equal(plan.plans[0].fields.dog_ids, 'd1|d2');
  assert.equal(plan.plans[0].fields.happened_at, NOW);
  assert.equal('time_given' in plan.plans[0].fields, false);
});

test('a room job and a whole-site line each name the place, and a note is required when the job says so', () => {
  const room = V.savePlans(world(job('daily_clean', { target: 'area', every_days: '1', sop: 'Cleaning' })), 'daily_clean', [{ kind: 'area', id: 'r1' }], {}, NOW);
  assert.equal(room.plans[0].fields.area_id, 'r1');
  assert.equal(room.plans[0].fields.subject_id, undefined);
  assert.equal(room.plans[0].fields.how_recorded, 'tapped');
  const site = V.savePlans(world(job('bowls', { target: 'none', site_scope: 'one_line', every_days: '1', sop: 'Cleaning' })), 'bowls', [{ kind: 'site' }], {}, NOW);
  assert.equal(site.plans[0].action, 'add');
  assert.equal(site.plans[0].fields.how_recorded, 'site_tap');
  const note = V.savePlans(world(job('lost', { target: 'optional', every_days: '', note_required: 'true', sop: 'Lost Dog' })), 'lost', [{ kind: 'site' }], {}, NOW);
  assert.match(note.error, /needed/);
  const ok = V.savePlans(world(job('lost', { target: 'optional', every_days: '', note_required: 'true', sop: 'Lost Dog' })), 'lost', [{ kind: 'site' }], { note: 'Found by the gate' }, NOW);
  assert.equal(ok.plans[0].fields.note, 'Found by the gate');
  assert.equal(ok.plans[0].fields.how_recorded, 'tapped');
});

test('each Jobs row has a tick and a day that defaults to today, and a dog job keeps a chooser', () => {
  const v = world(job('microchip_check', { label: 'Chip check' }));
  const html = V.complianceHtml(v, () => '');
  assert.match(html, /data-job-day="microchip_check"[^>]*max="2026-11-25"[^>]*value="2026-11-25"/);
  assert.match(html, /data-job-done="microchip_check"[^>]*aria-label="Done: Chip check"/);
  assert.match(html, /data-job-pick="microchip_check"[^>]*hidden/);
  assert.match(html, /data-job-tick="microchip_check"[^>]*value="d1"[^>]*checked/);
  assert.match(html, /data-job-all="microchip_check"/);
  const site = world(job('bowls', { target: 'none', site_scope: 'one_line', every_days: '1', label: 'Bowls', sop: 'Cleaning' }));
  const siteHtml = V.complianceHtml(site, () => '');
  assert.match(siteHtml, /data-job-done="bowls"/);
  assert.doesNotMatch(siteHtml, /data-job-pick="bowls"/);
});

test('a Jobs tick uses the Board tap: site is one add_site, a dog is one add, an earlier day is noon London', () => {
  const siteV = world(job('bowls', { target: 'none', site_scope: 'one_line', every_days: '1', sop: 'Cleaning' }));
  const today = V.tapPlans(siteV, 'bowls', [], {}, '2026-11-25', NOW);
  assert.equal(today.plans.length, 1);
  assert.equal(today.plans[0].action, 'add_site');
  assert.equal(today.plans[0].fields.how_recorded, 'site_tap');
  assert.equal(today.plans[0].fields.happened_at, NOW);
  assert.equal(today.plans[0].fields.outcome, 'ok');
  assert.equal(today.plans[0].fields.subject_id, undefined);
  assert.equal('taken_by' in today.plans[0].fields, false);
  const earlier = V.tapPlans(siteV, 'bowls', [], {}, '2026-11-20', NOW);
  assert.equal(earlier.plans[0].fields.happened_at, V.londonIso('2026-11-20', '12:00'));
  assert.equal(earlier.plans[0].fields.confirm_unusual, 'yes');
  assert.equal(earlier.plans[0].fields.how_recorded, 'site_tap');
  assert.equal(earlier.plans[0].action, 'add_site');
  assert.match(V.tapPlans(siteV, 'bowls', [], {}, '2026-11-26', NOW).error, /earlier/);
  const dog = V.tapPlans(world(job('microchip_check')), 'microchip_check', [{ kind: 'dog', id: 'd2' }], {}, '2026-11-25', NOW);
  assert.equal(dog.plans[0].action, 'add');
  assert.equal(dog.plans[0].fields.subject_id, 'd2');
  assert.equal(dog.plans[0].fields.how_recorded, 'tapped');
  assert.equal(dog.plans[0].fields.happened_at, NOW);
  const room = V.tapPlans(world(job('daily_clean', { target: 'area', every_days: '1', sop: 'Cleaning' })), 'daily_clean', [{ kind: 'area', id: 'r1' }], {}, '2026-11-25', NOW);
  assert.equal(room.plans[0].action, 'add');
  assert.equal(room.plans[0].fields.area_id, 'r1');
  assert.equal(room.plans[0].fields.how_recorded, 'tapped');
  const litter = V.tapPlans(world(job('pup_microchip', { target: 'litter', every_days: '', label: 'Puppy chips' })), 'pup_microchip', [{ kind: 'litter', id: 'lit1' }], {}, '2026-11-25', NOW);
  assert.equal(litter.plans[0].fields.litter_id, 'lit1');
  assert.equal(litter.plans[0].fields.subject_id, undefined);
  assert.equal(litter.plans[0].fields.how_recorded, 'tapped');
  const per = V.tapPlans(world(job('health', { target: 'none', site_scope: 'per_dog', every_days: '1', sop: 'Health Check' })), 'health', [{ kind: 'dog', id: 'd1' }, { kind: 'dog', id: 'd2' }], {}, '2026-11-25', NOW);
  assert.equal(per.plans.length, 1);
  assert.equal(per.plans[0].action, 'add_site');
  assert.equal(per.plans[0].fields.dog_ids, 'd1|d2');
  assert.equal(per.plans[0].fields.how_recorded, 'site_tap');
  assert.match(V.tapPlans(world(job('microchip_check')), 'microchip_check', [], {}, '2026-11-25', NOW).error, /Tick/);
});

test('the jobs table counts subjects on site that day, occupied rooms, and own-table last dates', () => {
  const subjects = [
    { id: 'sub-test-a', area_id: 'area-a', kind: 'adult', dob: '2020-01-01' },
    { id: 'sub-test-b', area_id: 'area-b', kind: 'adult', dob: '2020-01-01' },
    { id: 'sub-test-d', area_id: 'area-a', kind: 'pup', dob: '2026-10-01' }
  ];
  const occupancy = [
    { subject_id: 'sub-test-a', area_id: 'area-a', moved_in: '2026-01-01' },
    { subject_id: 'sub-test-d', area_id: 'area-a', moved_in: '2026-10-01' }
  ];
  const statuses = [
    { subject_id: 'sub-test-a', state: 'active', from_date: '2020-01-01' },
    { subject_id: 'sub-test-b', state: 'deceased', from_date: '2026-01-01' },
    { subject_id: 'sub-test-d', state: 'active', from_date: '2026-10-01' }
  ];
  const types = [
    Object.assign(T('daily_clean', 'area', '1'), { label: 'Daily clean', sop: 'Cleaning' }),
    Object.assign(T('deep_clean', 'area', '7'), { label: 'Deep clean', sop: 'Cleaning' }),
    Object.assign(T('health_check_all', 'none', '1'), { label: 'Health check', site_scope: 'per_dog', sop: 'Health' }),
    Object.assign(T('weight', 'dog', '7'), { label: 'Weight', sop: 'Health' })
  ];
  const areas = [
    { id: 'area-a', kind: 'room' },
    { id: 'area-b', kind: 'field' },
    { id: 'area-c', use: 'corridor' },
    { id: 'area-d', retired: true }
  ];
  const v = {
    today: '2026-11-16', logs: [], litters: [], types, dogs: subjects, subjects, occupancy, statuses, areas,
    records: { weight: [{ subject_id: 'sub-test-a', performed_on: '2026-11-10' }], dispense: [], vaccination: [], microchip: [] },
    rules: [], esc: (s) => String(s), dmy: (s) => s
  };
  const row = (key) => V.summary(v).find((r) => r.key === key);
  assert.equal(row('daily_clean').due, 1);
  assert.equal(row('deep_clean').due, 1);
  assert.equal(row('health_check_all').due, 1);
  assert.equal(row('weight').last_done, '2026-11-10');
  const ruled = Object.assign({}, v, { rules: [{ rule_key: 'job.exclude_juvenile.health_check_all', value: 'on', effective_from: '2026-01-01' }], logs: [{ id: 'h1', check_type_id: 'cty-health_check_all', subject_id: 'sub-test-a', outcome: 'ok', taken_at: '2026-11-16T09:00:00Z' }] });
  assert.equal(V.summary(ruled).find((r) => r.key === 'health_check_all').ok, 1);
});

test('only the owner hub loads jobs-view.js: inspector, print, temperature and register pages do not', () => {
  const fs = require('node:fs'), path = require('node:path');
  const root = path.join(__dirname, '..', '..', 'cdhub');
  const pages = [];
  (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'test') walk(p); } else if (/\.(html|js)$/.test(e.name)) pages.push(p); }); })(root);
  const users = pages.filter((p) => /jobs-view\.js/.test(fs.readFileSync(p, 'utf8')) && !/jobs-view\.js$/.test(p)).map((p) => path.relative(root, p));
  assert.deepEqual(users, ['index.html']);
});
