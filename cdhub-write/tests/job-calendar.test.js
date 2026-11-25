'use strict';
/** Daily records calendars (Lisa 17 Nov 2026): green when done, part done shows how many dogs, missed only after the job's
 *  first record; which jobs show is the owner's compliance.calendar.<job> rows. Invented rows only. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../cdhub/job-calendar.js');

const types = [
  { id: 'cty-hc', type_key: 'health_check_all', label: 'Health check: all dogs', target: 'none', site_scope: 'per_dog', active: 'true', effective_from: '2026-01-01', not_in_areas: 'iso' },
  { id: 'cty-fb', type_key: 'food_bowls', label: 'Food bowls washed', target: 'none', site_scope: 'one_line', active: 'true', effective_from: '2026-01-01' },
  { id: 'cty-ws', type_key: 'whole_site_clean', label: 'Whole site cleaned', target: 'none', site_scope: 'one_line', active: 'true', effective_from: '2026-01-01' }
];
const dogs = [{ id: 'd1', area_id: 'a1' }, { id: 'd2', area_id: 'a2' }, { id: 'd3', area_id: 'iso' }];
const log = (id, type, day, dog, extra) => Object.assign({ id, check_type_id: type, outcome: 'ok', taken_at: day + 'T10:00:00Z', subject_id: dog || '', taken_by: 'Pretend' }, extra || {});
const base = (logs, rules) => ({ today: '2026-11-17', types, dogs, logs, rules: rules || [], esc: (s) => String(s) });

test('a per-dog job is done only when every dog it covers has a line; isolation is not counted', () => {
  const v = base([log('1', 'cty-hc', '2026-11-15', 'd1'), log('2', 'cty-hc', '2026-11-16', 'd1'), log('3', 'cty-hc', '2026-11-16', 'd2')]);
  const m = C.month(v, 'health_check_all', '2026-11');
  const day = (iso) => m.cells.find((c) => c.iso === iso);
  assert.equal(m.need, 2);
  assert.equal(day('2026-11-14').state, 'before');   // before the job's first record: not tracked, never "missed"
  assert.equal(day('2026-11-15').state, 'part');
  assert.equal(day('2026-11-15').got, 1);
  assert.equal(day('2026-11-16').state, 'done');
  assert.equal(day('2026-11-17').state, 'due');      // today, not yet
  assert.equal(day('2026-11-18').state, 'future');
});

test('a one-line job is done with one record; a missed day after the first record is missed; notes and corrected rows do not count', () => {
  const v = base([log('1', 'cty-fb', '2026-11-10'), log('2', 'cty-fb', '2026-11-12'), log('3', 'cty-fb', '2026-11-13', '', { outcome: 'note' }),
    log('4', 'cty-fb', '2026-11-14'), log('5', 'cty-fb', '2026-11-14', '', { corrects_id: '4', outcome: 'not_done' })]);
  const m = C.month(v, 'food_bowls', '2026-11');
  const st = (iso) => m.cells.find((c) => c.iso === iso).state;
  assert.equal(st('2026-11-10'), 'done');
  assert.equal(st('2026-11-11'), 'missed');
  assert.equal(st('2026-11-13'), 'missed');
  assert.equal(st('2026-11-14'), 'missed');
});

test('the owner chooses which calendars show and in what order; no rows = the starter list', () => {
  assert.deepEqual(C.chosen(base([])), ['health_check_all', 'food_bowls', 'whole_site_clean']);   // water_bowls has no job row here
  const rules = [
    { rule_key: 'compliance.calendar.whole_site_clean', value: '1', effective_from: '2026-11-01' },
    { rule_key: 'compliance.calendar.health_check_all', value: '2', effective_from: '2026-11-01' },
    { rule_key: 'compliance.calendar.food_bowls', value: '0', effective_from: '2026-11-01' }
  ];
  assert.deepEqual(C.chosen(base([], rules)), ['whole_site_clean', 'health_check_all']);
});

test('Done today sends one whole-site record; a per-dog job lists every dog it covers', () => {
  assert.deepEqual(C.doneFields(base([]), 'health_check_all'), { check_type_id: 'cty-hc', outcome: 'ok', how_recorded: 'site_tap', dog_ids: 'd1|d2' });
  assert.deepEqual(C.doneFields(base([]), 'food_bowls'), { check_type_id: 'cty-fb', outcome: 'ok', how_recorded: 'site_tap' });
});

test('the calendar shows a Done today button until done, then a tick', () => {
  const before = C.html(base([log('1', 'cty-fb', '2026-11-16')]), '2026-11', true);
  assert.match(before, /data-jcal-done="food_bowls"/);
  const after = C.html(base([log('1', 'cty-fb', '2026-11-17')]), '2026-11', true);
  assert.doesNotMatch(after, /data-jcal-done="food_bowls"/);
  assert.match(after, /Done today/);
  assert.equal(C.shift('2026-01', -1), '2025-12');
  assert.equal(C.shift('2026-12', 1), '2027-01');
});

test('a pup counts on the health-check calendar only from its birth day, so the days before it are not "part done"', () => {
  const pups = dogs.concat([{ id: 'p1', area_id: 'a1', dob: '2026-11-15' }]);
  const v = Object.assign(base([log('1', 'cty-hc', '2026-11-14', 'd1'), log('2', 'cty-hc', '2026-11-14', 'd2'),
    log('3', 'cty-hc', '2026-11-15', 'd1'), log('4', 'cty-hc', '2026-11-15', 'd2')]), { dogs: pups });
  const day = (iso) => C.month(v, 'health_check_all', '2026-11').cells.find((c) => c.iso === iso);
  assert.equal(day('2026-11-14').state, 'done');     // before the pup was born: 2 of 2
  assert.equal(day('2026-11-15').state, 'part');     // born today: 2 of 3
  assert.equal(day('2026-11-15').need, 3);
});

test('a day with records opens who and when, notes, and its photos; a day with a photo shows a camera', () => {
  const v = Object.assign(base([log('1', 'cty-fb', '2026-11-10', '', { taken_by: 'Pat', note: 'Diary page 12' }), log('2', 'cty-fb', '2026-11-12')]), {
    dmy: (s) => s,
    files: [{ id: 'f1', name: 'diary-10-nov.jpg', drive_file_id: '1FAKEDIARYPAGEIDFORTESTS000000aa', mime: 'image/jpeg' }, { id: 'f2', name: 'cert.pdf', drive_file_id: '1FAKEPDFIDFORTESTS0000000000000b', mime: 'application/pdf' }],
    links: [{ from_table: 'check_log', from_id: '1', role: 'evidence', to_table: 'files', to_id: 'f1', from_date: '2026-11-10', to_date: '' },
      { from_table: 'check_log', from_id: '1', role: 'certificate', to_table: 'files', to_id: 'f2', from_date: '2026-11-10', to_date: '' }],
    calOpen: { key: 'food_bowls', iso: '2026-11-10' }
  });
  const html = C.html(v, '2026-11', false);
  assert.match(html, /<button type="button" class="jd done ph open" data-day="2026-11-10" data-jcal-day="2026-11-10" data-jcal-key="food_bowls"/);
  assert.match(html, /<button type="button" class="jd done" data-day="2026-11-12"/);   // records, no photo: opens, no camera
  assert.match(html, /<span class="jd missed" data-day="2026-11-11"/);                  // nothing recorded: not a button
  assert.match(html, /data-jcal-detail="2026-11-10"/);
  assert.match(html, /<li>Pat · \d\d:\d\d<\/li>/);
  assert.match(html, /Diary page 12/);
  assert.match(html, /href="https:\/\/drive\.google\.com\/file\/d\/1FAKEDIARYPAGEIDFORTESTS000000aa\/view"[^>]*data-jcal-photo[^>]*><img data-cal-photo-id="1FAKEDIARYPAGEIDFORTESTS000000aa"/);
  assert.match(html, /1FAKEPDFIDFORTESTS0000000000000b\/view"[^>]*data-jcal-photo[^>]*><span>certificate<\/span>/);   // a PDF: a link, no picture
});

// Lisa 22 Nov 2026: "Cross reference the dogs vet visit dates": a vet day shows on the health-check calendar, never as a check.
test('a vet visit shows on the per-dog calendar day (marker and details), not on one-line jobs, and never counts as a check', () => {
  const v = Object.assign(base([log('1', 'cty-hc', '2026-11-10', 'd1'), log('2', 'cty-hc', '2026-11-10', 'd2'), log('3', 'cty-fb', '2026-11-10')]), {
    dmy: (s) => s, dogNames: { d1: 'Pretend Dog' },
    vetVisits: [{ subject_id: 'd1', performed_on: '2026-11-12', start_time: '10:30', kind: 'appointment', status: 'done', reason: 'pretend vaccine' },
      { subject_id: 'd2', performed_on: '2026-11-13', start_time: '09:00', kind: 'appointment', status: 'booked', reason: 'not yet' }],
    calOpen: { key: 'health_check_all', iso: '2026-11-12' }
  });
  const html = C.html(v, '2026-11', false);
  const hc = html.slice(html.indexOf('data-jcal="health_check_all"'), html.indexOf('data-jcal="food_bowls"'));
  assert.match(hc, /<button type="button" class="jd missed vet open" data-day="2026-11-12"[^>]*title="2026-11-12: missed · vet: Pretend Dog"/);
  assert.match(hc, /data-jcal-vet><b>Vet<\/b><\/p><ul><li>Pretend Dog · 10:30 · pretend vaccine<\/li>/);
  assert.doesNotMatch(hc, /data-day="2026-11-13"[^>]*vet/);          // booked, not a visit
  assert.doesNotMatch(html.slice(html.indexOf('data-jcal="food_bowls"')), /class="jd [^"]*vet/);   // one-line jobs: no vet marker
  assert.match(html, /vet visit<\/p>/);                                // the key explains the marker
});

test('a vet visit stays on the health-check calendar and is not shown on Exercise and play @regression', () => {
  const exercise = { id: 'cty-ex', type_key: 'exercise_all', label: 'Exercise and play: all dogs', target: 'none', site_scope: 'per_dog', active: 'true', effective_from: '2026-01-01', not_in_areas: 'iso' };
  const shared = {
    types: types.concat([exercise]),
    dmy: (s) => s, dogNames: { d1: 'Dezi Pokey' },
    vetVisits: [{ subject_id: 'd1', performed_on: '2026-10-29', start_time: '', kind: 'appointment', status: 'done', reason: 'Two lesions on ear flap, likely tick bite; Isaderm gel' }],
    rules: [
      { rule_key: 'compliance.calendar.health_check_all', value: '1', effective_from: '2026-01-01' },
      { rule_key: 'compliance.calendar.exercise_all', value: '2', effective_from: '2026-01-01' }
    ]
  };
  const exHtml = C.html(Object.assign(base([log('1', 'cty-hc', '2026-11-10', 'd1')]), shared, { calOpen: { key: 'exercise_all', iso: '2026-10-29' } }), '2026-10', false);
  const ex = exHtml.slice(exHtml.indexOf('data-jcal="exercise_all"'));
  assert.doesNotMatch(ex, /data-jcal-vet/);
  assert.doesNotMatch(ex, /Dezi Pokey/);
  assert.doesNotMatch(ex, /Isaderm/);
  assert.doesNotMatch(ex, /class="jd [^"]*\bvet\b/);
  const hcHtml = C.html(Object.assign(base([log('1', 'cty-hc', '2026-11-10', 'd1')]), shared, { calOpen: { key: 'health_check_all', iso: '2026-10-29' } }), '2026-10', false);
  const hc = hcHtml.slice(hcHtml.indexOf('data-jcal="health_check_all"'), hcHtml.indexOf('data-jcal="exercise_all"'));
  assert.match(hc, /data-jcal-vet/);
  assert.match(hc, /Dezi Pokey/);
  assert.match(hc, /Isaderm gel/);
});

test('one session row marks every listed dog done, and an exception stays outstanding', () => {
  const v = base([log('s', 'cty-hc', '2026-11-16', '', { subject_id: '', covered_ids: 'd1|d2', exceptions: 'd2:concern:limping' })]);
  const day = C.month(v, 'health_check_all', '2026-11').cells.find((c) => c.iso === '2026-11-16');
  assert.equal(day.got, 1);
  assert.equal(day.state, 'part');
});

// Lisa 22 Nov 2026 ("A"): import past daily records from a spreadsheet. Every row is checked; only ready rows save, marked import.
test('import: rows are checked (date, job by name or key, outcome, future, repeat, already done) before anything saves', () => {
  const v = base([log('1', 'cty-fb', '2026-11-10')]);
  const rows = C.parseImport(v, 'date,job,outcome,note\r\n'
    + '2026-11-09,Food bowls washed,done,\r\n'      // ready, by name
    + '11/11/2026,whole_site_clean,,paper book\r\n' // ready, by key, UK date, blank outcome = done, note kept
    + '2026-11-10,food_bowls,done,\r\n'             // already recorded that day
    + '2026-11-09,Food bowls washed,done,\r\n'      // repeated in this file
    + '2026-11-30,food_bowls,done,\r\n'             // future
    + '31/02/2026,food_bowls,done,\r\n'             // not a real date
    + '2026-11-08,Pretend job,done,\r\n'            // job not found
    + '2026-11-08,food_bowls,maybe,\r\n'            // outcome not understood
    + '2026-11-12,Health check: all dogs,concern,"skin, ears"\r\n');
  assert.deepEqual(rows.map((x) => x.ok), [true, true, false, false, false, false, false, false, true]);
  assert.match(rows[2].why, /already recorded/);
  assert.equal(rows[2].ok, false);
  assert.match(rows[3].why, /repeated/);
  assert.match(rows[4].why, /future/);
  assert.match(rows[5].why, /date not understood/);
  assert.match(rows[6].why, /job not found/);
  assert.match(rows[7].why, /outcome/);
  assert.equal(rows[1].iso, '2026-11-11');
  assert.equal(rows[8].note, 'skin, ears');
  assert.deepEqual(C.importFields(v, rows[1]), { check_type_id: 'cty-ws', outcome: 'ok', how_recorded: 'import', happened_at: '2026-11-11T12:00:00Z', note: 'paper book' });
  assert.deepEqual(C.importFields(v, rows[8]), { check_type_id: 'cty-hc', outcome: 'concern', how_recorded: 'import', happened_at: '2026-11-12T12:00:00Z', note: 'skin, ears', dog_ids: 'd1|d2' });
  const tpl = C.template(v);
  assert.match(tpl, /^date,job,outcome,note\r\n2026-11-16,"Health check: all dogs",done,/);
});

// Lisa 22 Nov 2026: a Numbers export puts the table name ("Csv", "daily-records") above the heading row. It is left out.
test('import: title lines above the heading row are left out, never shown as a row', () => {
  const v = base([]);
  const rows = C.parseImport(v, 'daily-records\r\nCsv,,,\r\ndate,job,outcome,note\r\n2026-11-09,Food bowls washed,done,\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ok, true);
  assert.equal(rows[0].line, 1);
});

// Lisa 22 Nov 2026: "Imported 1 of 16", the rest refused as "more than 7 days ago. Save anyway?". The owner has seen every
// date before pressing Import, so a row older than 7 days is sent with the save-anyway answer; a recent row is not.
test('import: a part-done day is not "already recorded"; a fully done day is, and is not sent', () => {
  const v = base([log('1', 'cty-hc', '2026-11-15', 'd1'), log('2', 'cty-hc', '2026-11-16', 'd1'), log('3', 'cty-hc', '2026-11-16', 'd2')]);
  const rows = C.parseImport(v, 'date,job,outcome,note\r\n2026-11-15,health_check_all,done,\r\n2026-11-16,health_check_all,done,\r\n');
  assert.equal(rows[0].ok, true);
  assert.equal(rows[1].ok, false);
  assert.match(rows[1].why, /already recorded/);
  assert.equal(C.importFields(v, rows[0]).check_type_id, 'cty-hc');
});

test('import: a row older than 7 days is sent with the save-anyway answer; a recent row is not', () => {
  const v = base([]);
  const rows = C.parseImport(v, 'date,job,outcome,note\r\n2026-11-10,food_bowls,done,\r\n2026-11-11,food_bowls,done,\r\n2026-10-01,food_bowls,done,\r\n');
  assert.deepEqual(rows.map((x) => x.old), [true, false, true]);
  assert.equal(C.importFields(v, rows[0]).confirm_unusual, 'yes');
  assert.equal('confirm_unusual' in C.importFields(v, rows[1]), false);
  assert.match(C.previewHtml(v, rows), /ready \(older than 7 days\)/);
});
