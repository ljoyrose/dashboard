'use strict';
const test = require('node:test');
const assert = require('node:assert');
const View = require('../../breed-better/hub-view.js');

const esc = (s) => String(s).replace(/[&<>"]/g, '');
function tables(extra) {
  return Object.assign({
    'BLD-score_scheme.csv': [{ id: 's1', status: 'active', effective_from: '2026-01-01' }],
    'BLD-score_band.csv': [{ id: 'g', scheme_id: 's1', kind: 'gate', label: 'Gates', colour: 'red', sort_order: '1' }, { id: 't', scheme_id: 's1', kind: '', label: 'TOTAL' }],
    'BLD-score_criterion.csv': [{ id: 'c', scheme_id: 's1', band_id: 'g', label: 'Check', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on' }],
    'BLD-score_point.csv': [{ id: 'p', criterion_id: 'c', answer_match: 'is:ok', gate_outcome: 'pass' }, { id: 'q', criterion_id: 'c', answer_match: 'any', gate_outcome: 'fail' }],
    'BLD-score_enrolment.csv': [{ id: 'e1', scheme_id: 's1', subject_id: 'a1' }, { id: 'e2', scheme_id: 's1', subject_id: 'a2' }],
    'BLD-subject.csv': [{ id: 'a1', name: 'Alpha' }, { id: 'a2', name: 'Beta' }, { id: 'a3', name: 'NotEnrolled' }],
    'BLD-exam.csv': [{ id: 'x', subject_id: 'a1', r: 'ok', on: '2026-01-02' }]
  }, extra);
}

test('only enrolled animals are scored, best first', () => {
  const c = View.compute({ T: tables(), today: '2026-06-01', esc });
  assert.deepEqual(c.results.map((r) => [r.name, r.gate_result]), [['Alpha', 'pass'], ['Beta', 'unverified']]);
  assert.equal(c.byId.a3, undefined);
});

test('the chip is empty for an animal not enrolled', () => {
  const v = { T: tables(), today: '2026-06-02', esc };
  assert.equal(View.chip(v, 'a3'), '');
  assert.match(View.chip(v, 'a1'), /data-go="breed"/);
});

test('with no enrolment rows the page says not set up', () => {
  const v = { T: tables({ 'BLD-score_enrolment.csv': [] }), today: '2026-06-03', esc };
  assert.match(View.page(v), /Not set up yet/);
});

test('a draft scheme scores nothing and says so', () => {
  const v = { T: tables({ 'BLD-score_scheme.csv': [{ id: 's1', status: 'draft', effective_from: '2026-01-01' }] }), today: '2026-06-04', esc };
  assert.match(View.page(v), /No active scheme/);
});

test('dates read like 2 Mar 2026', () => {
  assert.equal(View.day('2026-03-02'), '2 Mar 2026');
  assert.equal(View.day(''), '');
});

test('a scheme row can rename any verdict word', () => {
  const w = View.wordsFor({ verdict_words: 'unverified=To prove; below target=Under 65' });
  assert.equal(w.unverified, 'To prove');
  assert.equal(w.below_target, 'Under 65');
  assert.equal(w.pass, 'Pass');
});

test('filters run best to worst and the page shows target, dates and Due', () => {
  const T = tables({
    'BLD-score_scheme.csv': [{ id: 's1', status: 'active', effective_from: '2026-01-01', verdict_words: 'unverified=To prove' }],
    'BLD-score_criterion.csv': [{ id: 'c', scheme_id: 's1', band_id: 'g', label: 'Check', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on', valid_months: '12', lapsed_affects_verdict: 'FALSE' }]
  });
  const v = { T, today: '2027-02-01', esc };
  const html = View.page(v);
  assert.match(html, /All[\s\S]*Pass[\s\S]*Below target[\s\S]*To prove[\s\S]*Fail/);
  assert.doesNotMatch(html, /Unverified/);
  const c = View.compute(v);
  assert.equal(c.byId.a1.verdict, 'pass');
  assert.equal(c.byId.a1.lines[0].due, 'overdue');
  assert.match(View.page(v), /1 due/);
});

test('staff never see Breed Better: no staff, guest or print page loads it', () => {
  const fs = require('node:fs'), path = require('node:path');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const hits = walk(path.join(__dirname, '../../cdhub/staff')).filter((f) => /\.(html|js)$/.test(f) && /breed-better|BBHubView/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});

test('Fit to Breed is read from BLD-fit_to_breed, which the hub loads as an optional file', () => {
  assert.ok(View.FILES.includes('BLD-fit_to_breed.csv'));
  const T = tables({
    'BLD-score_criterion.csv': [{ id: 'c', scheme_id: 's1', band_id: 'g', label: 'Fit to Breed', evidence_source: 'BLD-fit_to_breed', answer_field: 'outcome', date_field: 'assessed_on' }],
    'BLD-score_point.csv': [{ id: 'p', criterion_id: 'c', answer_match: 'is:fit', gate_outcome: 'pass' }, { id: 'q', criterion_id: 'c', answer_match: 'any', gate_outcome: 'fail' }],
    'BLD-fit_to_breed.csv': [{ id: 'f1', subject_id: 'a1', outcome: 'fit', assessed_on: '2026-10-03' }]
  });
  const c = View.compute({ T, today: '2026-11-11', esc });
  assert.equal(c.byId.a1.verdict, 'pass');
  assert.equal(c.byId.a1.lines[0].date_then, '2026-10-03');
});

test('within a verdict, animals rank by percent of what they could earn', () => {
  const T = tables({
    'BLD-score_band.csv': [{ id: 'p', scheme_id: 's1', kind: 'points', label: 'Pts', sort_order: '1' }],
    'BLD-score_criterion.csv': [
      { id: 'c', scheme_id: 's1', band_id: 'p', label: 'A', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on' },
      { id: 'd', scheme_id: 's1', band_id: 'p', label: 'B', evidence_source: 'BLD-exam', answer_field: 'q', date_field: 'on', applies_to: 'sex=female' }],
    'BLD-score_point.csv': [{ id: 'p1', criterion_id: 'c', answer_match: 'is:ok', points: '10' }, { id: 'p2', criterion_id: 'c', answer_match: 'any', points: '0' },
      { id: 'p3', criterion_id: 'd', answer_match: 'is:ok', points: '10' }, { id: 'p4', criterion_id: 'd', answer_match: 'any', points: '0' }],
    'BLD-subject.csv': [{ id: 'a1', name: 'Female', sex: 'female' }, { id: 'a2', name: 'Male', sex: 'male' }],
    'BLD-exam.csv': [{ id: 'x', subject_id: 'a1', r: 'ok', q: 'no', on: '2026-01-02' }, { id: 'y', subject_id: 'a2', r: 'ok', on: '2026-01-02' }]
  });
  const c = View.compute({ T, today: '2026-06-05', esc });
  assert.deepEqual(c.results.map((r) => [r.name, r.points_earned, r.points_available]), [['Male', 10, 10], ['Female', 10, 20]]);
});

test('seven sort choices, verdict best to worst first; no date of birth sorts last', () => {
  assert.deepStrictEqual(View.SORTS.map((s) => s[0]), ['verdict', 'high', 'low', 'name', 'oldest', 'youngest', 'attention']);
  const R = (name, verdict, e, a, dob) => ({ name, verdict, points_earned: e, points_available: a, dob: dob || '' });
  const rows = [R('Cara', 'fail', 0, 10, '2020-01-01'), R('Abe', 'pass', 8, 10, '2022-05-01'), R('Bo', 'pass', 9, 10), R('Dot', 'unverified', 2, 10, '2019-03-01')];
  const names = (k) => View.sortRows(rows, k).map((r) => r.name);
  assert.deepStrictEqual(names('verdict'), ['Bo', 'Abe', 'Dot', 'Cara']);
  assert.deepStrictEqual(names('high'), ['Bo', 'Abe', 'Dot', 'Cara']);
  assert.deepStrictEqual(names('low'), ['Cara', 'Dot', 'Abe', 'Bo']);
  assert.deepStrictEqual(names('name'), ['Abe', 'Bo', 'Cara', 'Dot']);
  assert.deepStrictEqual(names('oldest'), ['Dot', 'Cara', 'Abe', 'Bo']);
  assert.deepStrictEqual(names('youngest'), ['Abe', 'Cara', 'Dot', 'Bo']);
  assert.deepStrictEqual(names('attention'), ['Cara', 'Dot', 'Abe', 'Bo']);
});

test('the list page has a name search and the sort choice', () => {
  const html = View.page({ T: tables(), today: '2026-06-01', esc });
  assert.match(html, /data-bb-search/);
  assert.match(html, /<option value="verdict" selected>Verdict, Pass to Fail<\/option>/);
  assert.match(html, /id="bbList"/);
});

test('every verdict filter shows its count, 0 included', () => {
  const html = View.page({ T: tables(), today: '2026-06-01', esc });
  assert.match(html, /data-bb-filter="below_target"[^>]*>Below target <span class="cnt">0<\/span>/);
});

test('the Testing label explains itself: trial scores, not yet signed off', () => {
  const html = View.page({ T: tables(), today: '2026-06-01', esc });
  assert.match(html, /<span class="bb-v bb-test" title="Trial scores, not yet signed off">Testing<\/span>/);
});

test('an enrolment with a to_date stops on the day after it', () => {
  const T = tables({ 'BLD-score_enrolment.csv': [{ id: 'e1', scheme_id: 's1', subject_id: 'a1', to_date: '2026-06-10' }] });
  assert.equal(View.compute({ T, today: '2026-06-10', esc }).results.length, 1);
  assert.equal(View.compute({ T, today: '2026-06-11', esc }).results.length, 0);
});

test('a later version of the enrolled scheme takes over on its own date; old records say rules then', () => {
  const T = tables({
    'BLD-score_scheme.csv': [{ id: 's1', name: 'Trial', status: 'active', effective_from: '2026-01-01' },
      { id: 's2', name: 'Trial', status: 'active', effective_from: '2026-07-01', version: '2' }],
    'BLD-score_band.csv': [{ id: 'g', scheme_id: 's1', kind: 'gate' }, { id: 'g2', scheme_id: 's2', kind: 'gate' }],
    'BLD-score_criterion.csv': [{ id: 'c', scheme_id: 's1', band_id: 'g', label: 'Check', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on' },
      { id: 'c2', scheme_id: 's2', band_id: 'g2', label: 'Check', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on' }],
    'BLD-score_point.csv': [{ id: 'p', criterion_id: 'c', answer_match: 'any', gate_outcome: 'pass' },
      { id: 'p2', criterion_id: 'c2', answer_match: 'is:ok', gate_outcome: 'pass', to_date: '2026-06-30' },
      { id: 'p3', criterion_id: 'c2', answer_match: 'is:ok', gate_outcome: 'fail', from_date: '2026-07-01' },
      { id: 'p4', criterion_id: 'c2', answer_match: 'any', gate_outcome: 'fail' }]
  });
  assert.equal(View.compute({ T, today: '2026-06-20', esc }).byId.a1.scheme_id, 's1');
  const later = View.compute({ T, today: '2026-07-20', esc });
  assert.equal(later.byId.a1.scheme_id, 's2');
  assert.equal(later.byId.a1.gate_result, 'pass');
  assert.equal(later.byId.a1.lines[0].rules_then, true);
  assert.match(View.lineHtml({ esc }, later.byId.a1.lines[0]), /rules then/);
});

/* Mock-up screens (12 Nov 2026): list row, Information fold, verdict box, must-pass star */
function pointsTables() {
  return tables({
    'BLD-score_scheme.csv': [{ id: 's1', status: 'active', effective_from: '2026-01-01', target_points: '6' }],
    'BLD-score_band.csv': [
      { id: 'g', scheme_id: 's1', kind: 'gate', label: 'Must pass', colour: 'red', sort_order: '1' },
      { id: 'h', scheme_id: 's1', kind: 'points', label: 'Health', colour: 'orange', sort_order: '2' },
      { id: 't', scheme_id: 's1', kind: '', label: 'TOTAL' }],
    'BLD-score_criterion.csv': [
      { id: 'c', scheme_id: 's1', band_id: 'g', label: 'Check', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on' },
      { id: 'h1', scheme_id: 's1', band_id: 'h', label: 'Hips', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on' },
      { id: 'h2', scheme_id: 's1', band_id: 'h', label: 'Eyes', evidence_source: 'BLD-eyes', answer_field: 'r', date_field: 'on' }],
    'BLD-score_point.csv': [
      { id: 'p', criterion_id: 'c', answer_match: 'is:ok', gate_outcome: 'pass' },
      { id: 'p1', criterion_id: 'h1', answer_match: 'is:ok', points: '4' }, { id: 'p0', criterion_id: 'h1', answer_match: 'any', points: '0' },
      { id: 'p2', criterion_id: 'h2', answer_match: 'is:ok', points: '5' }],
    'BLD-subject.csv': [{ id: 'a1', name: 'Alpha', dob: '2023-01-15' }, { id: 'a2', name: 'Beta' }]
  });
}
const hubDogs = { a1: { id: 'a1', sex: 'Female', breed: 'Example breed', photo: 'PHOTOID12345', chip: '900000000004821', colour: { name: 'Chocolate' }, state: 'Active', littersAsDam: [{}, {}] } };

test('age reads in years and months on the day given', () => {
  assert.equal(View.age('2023-01-15', '2026-08-14'), '3 yrs 6 mths');
  assert.equal(View.age('2026-05-01', '2026-06-01'), '1 mth');
  assert.equal(View.age('', '2026-06-01'), '');
});

test('a list row shows the photo inside the score ring, sex and age, and the verdict word', () => {
  const v = { T: pointsTables(), today: '2026-08-14', esc, dogs: hubDogs, photoId: (x) => x };
  const html = View.page(v);
  assert.match(html, /bb-ring[\s\S]*data-photo-id="PHOTOID12345"/);
  assert.match(html, /Female, 3 yrs 6 mths/);
  assert.match(html, /bb-vw[\s\S]*Unverified/);
});

test('the dog page has the Information fold, the verdict box and a star on must-pass lines', () => {
  View.open('a1');
  const v = { T: pointsTables(), today: '2026-08-14', esc, dogs: hubDogs, photoId: (x) => x };
  const html = View.page(v);
  View.open('');
  assert.match(html, /Information[\s\S]*Born 15 Jan 2023[\s\S]*Chocolate[\s\S]*Chip \.\.\.4821[\s\S]*2 litters/);
  assert.match(html, /4 earned<\/span><span>5 to prove<\/span><span>0 lost/);
  assert.match(html, /bb-tmark" style="left:66\.6/);
  assert.match(html, /aria-label="Must pass"[\s\S]*Check/);
  assert.match(html, /5 points still to prove could reach the target/);
});

test('band stats split each points section into earned and to prove', () => {
  const c = View.compute({ T: pointsTables(), today: '2026-08-15', esc });
  const st = View.bandStats(c.byId.a1);
  assert.deepEqual(st.map((o) => [o.band.id, o.max, o.earned, o.unv]), [['h', 9, 4, 5]]);
});

/* Calendar, More, My system, Archive and the sex filter (mock-up, 12 Nov 2026) */
test('the list page has Dogs, Calendar and More tabs', () => {
  const html = View.page({ T: pointsTables(), today: '2026-08-14', esc, dogs: hubDogs, photoId: (x) => x });
  assert.match(html, /data-bb-tab="dogs"[^>]*aria-current="page"[\s\S]*data-bb-tab="cal"[\s\S]*data-bb-tab="more"/);
});

test('the calendar lists due dates from the rules, overdue ones marked', () => {
  const T = pointsTables();
  T['BLD-score_criterion.csv'][1].valid_months = '12';
  T['BLD-score_criterion.csv'][1].due_soon_days = '60';
  T['BLD-exam.csv'] = [{ id: 'x', subject_id: 'a1', r: 'ok', on: '2025-08-20' }];
  View.setTab('cal');
  const html = View.page({ T, today: '2026-08-13', esc });
  View.setTab('dogs');
  assert.match(html, /Calendar[\s\S]*Aug 2026/);
  assert.match(html, /Alpha, Hips[\s\S]*20 Aug 2026/);
});

test('the archive lists animals whose enrolment has ended, with dates', () => {
  const T = pointsTables();
  T['BLD-score_enrolment.csv'] = [{ id: 'e1', scheme_id: 's1', subject_id: 'a1' }, { id: 'e2', scheme_id: 's1', subject_id: 'a2', valid_from: '2025-01-01', to_date: '2026-03-02' }];
  View.setTab('archive');
  const html = View.page({ T, today: '2026-08-12', esc });
  View.setTab('dogs');
  assert.match(html, /Archive[\s\S]*Beta[\s\S]*From 1 Jan 2025, to 2 Mar 2026/);
});

test('My system shows the rules in force today, read only, with the must-pass star', () => {
  View.setTab('system');
  const html = View.page({ T: pointsTables(), today: '2026-08-14', esc });
  View.setTab('dogs');
  assert.match(html, /My system[\s\S]*Target 6/);
  assert.match(html, /aria-label="Must pass"[\s\S]*Check[\s\S]*is:ok: Pass/);
  assert.match(html, /Hips[\s\S]*is:ok: 4 points/);
  assert.doesNotMatch(html, /<input|<select/);
});

test('the sex filter appears when there is more than one sex, with counts', () => {
  const dogs = Object.assign({}, hubDogs, { a2: { id: 'a2', sex: 'Male' } });
  const html = View.page({ T: pointsTables(), today: '2026-08-14', esc, dogs });
  assert.match(html, /data-bb-sex="Female"[^>]*>Female <span class="cnt">1/);
  assert.match(html, /data-bb-sex="Male"/);
});

/* DNA Kit on the Breed Better dog page and the per-puppy calculator under More */
test('the dog page shows the DNA card from dna_result and dna_marker rows', () => {
  const T = pointsTables();
  T['BLD-dna_marker.csv'] = [{ code: 'TESTR', name: 'Recessive example', inheritance_mode: 'autosomal recessive', copies_0: 'clear', copies_1: 'carrier', copies_2: 'affected' }];
  T['BLD-dna_result.csv'] = [{ subject_id: 'a1', marker_code: 'TESTR', copies: '1' }];
  View.open('a1');
  const html = View.page({ T, today: '2026-08-11', esc });
  View.open('');
  assert.match(html, /bb-dna[\s\S]*1 Carrier[\s\S]*TESTR/);
});

test('Open on a check is the add/edit control, not a jump back to the dog list', () => {
  View.open('a1');
  const html = View.page({ T: tables(), today: '2026-06-01', esc });
  View.open('');
  assert.match(html, /data-bb-edit="c"[^>]*>Open</);
  assert.doesNotMatch(html, /data-go="dogs"/);
  assert.match(html, /data-bb-edit-screen|bb-line/);
});

test('More offers the per-puppy calculator', () => {
  const T = pointsTables();
  T['BLD-dna_marker.csv'] = [{ code: 'TESTR', name: 'Recessive example', inheritance_mode: 'autosomal recessive', copies_0: 'clear', copies_1: 'carrier', copies_2: 'affected' }];
  View.setTab('dna');
  const html = View.page({ T, today: '2026-08-10', esc });
  View.setTab('dogs');
  assert.match(html, /Probability per puppy[\s\S]*TESTR/);
});

test('a band colour may be a kit word or a #hex; anything else is the line grey', () => {
  assert.equal(View.bandColour({ colour: 'Red' }), 'var(--ljr-2)');
  assert.equal(View.bandColour({ colour: '#ee4035' }), '#ee4035');
  assert.equal(View.bandColour({ colour: 'url(x)' }), 'var(--line)');
  assert.equal(View.bandColour({}), 'var(--line)');
});

test('a section is coloured by its worst line: fail, then unverified, then below target, else pass', () => {
  assert.equal(View.secResult([{ kind: 'gate', gate_outcome: 'pass' }, { kind: 'gate', gate_outcome: 'fail' }]), 'fail');
  assert.equal(View.secResult([{ kind: 'gate', gate_outcome: 'pass' }, { kind: 'gate', gate_outcome: 'unverified' }]), 'unverified');
  assert.equal(View.secResult([{ kind: 'points', points: '', points_max: 5 }]), 'unverified');
  assert.equal(View.secResult([{ kind: 'points', points: 3, points_max: 5 }]), 'below_target');
  assert.equal(View.secResult([{ kind: 'points', points: 5, points_max: 5 }]), 'pass');
  assert.equal(View.secResult([{ kind: 'status', answer_then: 'Active' }]), '');
});

test('a section icon comes from the row icon cell, else its key, else a plain circle (must pass: the star)', () => {
  const heart = View.secIcon({ key: 'health' });
  assert.equal(View.secIcon({ key: 'anything', icon: 'heart' }), heart);
  assert.notEqual(View.secIcon({ key: 'unknown_key' }), heart);
  assert.equal(View.secIcon({ key: 'unknown_key', kind: 'gate' }), View.secIcon({ key: 'gate' }));
});

test('species words come from the scheme species row; with none, neutral words', () => {
  const sp = { 'BLD-score_scheme.csv': [{ id: 's1', status: 'active', effective_from: '2026-01-01', species_id: 'sp-h' }],
    'BLD-species.csv': [{ id: 'sp-h', common_name: 'Horse', plural_word: 'Horses' }] };
  View.setTab('dogs');
  const on = View.page({ T: tables(sp), today: '2026-06-12', esc });
  assert.match(on, /Find a horse<input/);
  assert.match(on, /<\/span>Horses<\/button>/);
  const off = View.page({ T: tables(), today: '2026-06-13', esc });
  assert.match(off, /">Find<input/);
});

test('the dog page has Back, Previous and Next in list order, and the logo header', () => {
  View.setTab('dogs');
  View.open('a1');
  const html = View.page({ T: tables(), today: '2026-06-14', esc });
  assert.match(html, /class="bb-top"><img class="bb-logo"/);
  assert.match(html, /data-bb-open="" disabled>.*Previous/);
  assert.match(html, /data-bb-open="a2" aria-label="Next: Beta">Next/);
  assert.match(html, /1 of 2/);
  View.open('');
});

test('More offers Inspector links: the owner page address from the host, or where to set it up', () => {
  View.setTab('more');
  const on = View.page({ T: tables(), today: '2026-06-09', esc, ownerPage: 'https://script.google.com/macros/s/X/exec?page=approve' });
  assert.match(on, /<a class="bb-dog" href="https:\/\/script\.google\.com\/macros\/s\/X\/exec\?page=approve" target="_blank" rel="noopener"><span class="bb-name">Inspector links/);
  const off = View.page({ T: tables(), today: '2026-06-10', esc });
  assert.match(off, /Set up saving first/);
  assert.doesNotMatch(View.page({ T: tables(), today: '2026-06-11', esc, ownerPage: 'javascript:x' }), /href="javascript/);
  View.setTab('dogs');
});

const LINK = (id, sub, from, to, why) => ({ id, from_table: 'subject', from_id: sub, role: 'enrolled_in', to_table: 'score_scheme', to_id: 's1', from_date: from, to_date: to || '', end_reason: why || '' });

test('enrolments: link rows count, and a link takes over from the older row for that animal and scheme', () => {
  const T = tables({ 'BLD-links.csv': [LINK('l1', 'a3', '2026-01-01'), LINK('l2', 'a2', '2026-01-01', '2026-03-01', 'Rehomed')] });
  const e = View.enrolments(T);
  assert.deepEqual(e.map((x) => [x.subject_id, x.src]).sort(), [['a1', 'legacy'], ['a2', 'link'], ['a3', 'link']]);
  const c = View.compute({ T, today: '2026-06-15', esc });
  assert.deepEqual(c.results.map((r) => r.name).sort(), ['Alpha', 'NotEnrolled']);
  assert.deepEqual(c.ended.map((x) => [x.name, x.to, x.reason]), [['Beta', '2026-03-01', 'Rehomed']]);
  assert.equal(c.enrol.a3.src, 'link');
});

test('un-enrol ends yesterday, or today when the enrolment began today', () => {
  assert.equal(View.endDay({ from: '2026-01-01' }, '2026-06-15'), '2026-06-14');
  assert.equal(View.endDay({ from: '2026-06-15' }, '2026-06-15'), '2026-06-15');
});

test('an enrolled card has Un-enrol (off without a save route); a card not enrolled shows Not in Breed Better with Enrol', () => {
  const T = tables({ 'BLD-links.csv': [LINK('l2', 'a2', '2026-01-01', '2026-03-01', 'Rehomed')] });
  const off = View.section({ T, today: '2026-06-16', esc }, 'a1');
  assert.match(off, /data-bb-unenrol="a1" disabled>Un-enrol/);
  const on = View.section({ T, today: '2026-06-17', esc, canWrite: () => true, enrol() {}, unenrol() {} }, 'a1');
  assert.match(on, /data-bb-unenrol="a1">Un-enrol/);
  const out = View.section({ T, today: '2026-06-18', esc, canWrite: () => true, enrol() {}, unenrol() {} }, 'a2');
  assert.match(out, /Not in Breed Better/);
  assert.match(out, /Ended 1 Mar 2026: Rehomed/);
  assert.match(out, /data-bb-enrol="a2" data-bb-scheme="s1">Enrol/);
  assert.equal(View.section({ T: tables({ 'BLD-score_scheme.csv': [] }), today: '2026-06-19', esc }, 'a3'), '');
});

test('a pup not enrolled shows its DNA chances from its parents', () => {
  const T = tables({
    'BLD-subject.csv': [{ id: 'a1', name: 'Alpha' }, { id: 'a2', name: 'Beta' }, { id: 'p1', name: 'Pup', birth_litter_id: 'L1' }],
    'BLD-litter.csv': [{ id: 'L1', dam_subject_id: 'a1', sire_subject_id: 'a2' }],
    'BLD-dna_marker.csv': [{ code: 'TR', name: 'Test recessive', inheritance_mode: 'autosomal recessive' }],
    'BLD-dna_result.csv': [{ subject_id: 'a1', marker_code: 'TR', copies: '1' }, { subject_id: 'a2', marker_code: 'TR', copies: '1' }]
  });
  const html = View.section({ T, today: '2026-06-20', esc }, 'p1');
  assert.match(html, /Test recessive<\/span><span class="bb-pts">25% clear, 50% carrier, 25% affected or at risk/);
});

test('the auto-enrol setting is one dated link-kind rule row listing schemes; no row reads as off', () => {
  const key = View.autoKey();
  assert.equal(key, 'link_kind.enrolled_in.inherit_at_birth');
  const T = { 'BLD-score_scheme.csv': [{ id: 's1', status: 'active', effective_from: '2026-01-01' }, { id: 's2' }], 'BLD-breeding_rule.csv': [{ rule_key: key, value: 's1', effective_from: '2026-11-15', source: 'Lisa' }, { rule_key: key, value: 'none', effective_from: '2026-12-01' }, { rule_key: key, value: '*', effective_from: '2027-01-01' }] };
  assert.equal(View.ruleOn(T, key, '2026-11-14'), null);
  assert.equal(View.autoOn(T, 's1', '2026-11-14'), false);
  assert.equal(View.autoOn(T, 's1', '2026-11-20'), true);
  assert.equal(View.autoOn(T, 's2', '2026-11-20'), false);
  assert.equal(View.autoOn(T, 's1', '2026-12-02'), false);
  assert.equal(View.autoOn(T, 's2', '2027-01-02'), true);
  assert.equal(View.autoNext(T, '2026-11-20', 's2', true), 's1|s2');
  assert.equal(View.autoNext(T, '2026-11-20', 's1', false), 'none');
  assert.equal(View.autoNext(T, '2026-12-02', 's2', true), 's2');
  assert.equal(View.autoNext(T, '2027-01-02', 's1', false), 's2');
  assert.equal(View.autoNext(T, '2027-01-02', 's1', true), '*');
  View.setTab('system');
  const html = View.page({ T: tables(T), today: '2026-11-20', esc });
  assert.match(html, /data-bb-auto-v="on" aria-pressed="true" disabled>On/);
  assert.match(html, /Since 15 Nov 2026\. Lisa/);
  View.setTab('dogs');
});

test('age groups come from dated owner rows; with none there is no age filter', () => {
  const R = (k, v, from, extra) => Object.assign({ rule_key: k, value: v, effective_from: from || '2026-01-01', source: 'Owner' }, extra || {});
  const rules = [R('age_group.young.from_months', '0'), R('age_group.young.to_months', '12'), R('age_group.young.label', 'Under 1'),
    R('age_group.adult.from_months', '12'), R('age_group.adult.label', 'Adult'),
    R('age_group.later.from_months', '99', '2027-01-01'),
    R('age_group.bad.label', 'No months')];
  const T = { 'BLD-breeding_rule.csv': rules };
  const g = View.ageGroups(T, '2026-11-15');
  assert.deepEqual(g.map((x) => [x.key, x.label, x.from, x.to]), [['young', 'Under 1', 0, 12], ['adult', 'Adult', 12, Infinity]]);
  assert.equal(View.months('2025-11-16', '2026-11-15'), 11);
  assert.equal(View.inAge(g[0], '2025-11-16', '2026-11-15'), true);
  assert.equal(View.inAge(g[1], '2025-11-15', '2026-11-15'), true);
  assert.equal(View.inAge(g[0], '', '2026-11-15'), false);
  View.setTab('dogs');
  const withRows = View.page({ T: tables(T), today: '2026-11-15', esc });
  assert.match(withRows, /aria-label="Filter by age"/);
  assert.match(withRows, /data-bb-age="young" aria-pressed="false">Under 1 <span class="cnt">/);
  const none = View.page({ T: tables({}), today: '2026-11-15', esc });
  assert.doesNotMatch(none, /Filter by age/);
});
