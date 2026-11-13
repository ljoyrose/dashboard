'use strict';
// Breed Better built to the owner's design (13 Nov 2026): five bottom tabs, Calendar Due / Done / All, the subtle look, section
// icons and colours from rows, the dog-page wording, judged answers, Evidence, History, viewer levels and the DNA panel bands.
// Invented rows only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const View = require('../../breed-better/hub-view.js');
const Dna = require('../../breed-better/dna-panel.js');
const Levels = require('../../cdhub/staff/lib/viewer-levels.js');

const esc = (s) => String(s).replace(/[&<>"]/g, '');
const ROOT = path.resolve(__dirname, '..', '..');

/** An invented scheme: target 60% of points available, a must-pass band with a female-only line, a judged points line. */
function T(extra) {
  return Object.assign({
    'BLD-score_scheme.csv': [{ id: 's1', name: 'Invented', species_id: 'dog', status: 'active', effective_from: '2026-01-01', target_points: '60', target_is: 'percent' }],
    'BLD-score_band.csv': [
      { id: 'g', scheme_id: 's1', kind: 'gate', label: 'Section G', colour: 'red', sort_order: '1', icon_key: 'star', line_colour: '#ee4035', icon_light: '#ca362d', icon_dark: '#f0625a' },
      { id: 'a', scheme_id: 's1', kind: 'points', label: 'Section A', colour: 'purple', sort_order: '2', icon_key: 'target' },
      { id: 'h', scheme_id: 's1', kind: 'points', label: 'Section B', colour: 'orange', sort_order: '3', icon_key: 'no-such-icon' },
      { id: 's', scheme_id: 's1', kind: 'status', label: 'Status', colour: 'black', sort_order: '4' }],
    'BLD-score_criterion.csv': [
      { id: 'c1', scheme_id: 's1', band_id: 'g', key: 'k1', label: 'Check One', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on', valid_months: '12', due_soon_days: '30', lapsed_affects_verdict: 'FALSE', proof_label: 'a signed certificate' },
      { id: 'c2', scheme_id: 's1', band_id: 'g', key: 'k2', label: 'Check Two', evidence_source: 'BLD-exam2', answer_field: 'r', date_field: 'on', applies_to: 'sex=F' },
      { id: 'j1', scheme_id: 's1', band_id: 'a', key: 'look', label: 'Looks answer', evidence_source: 'judged' },
      { id: 'p1', scheme_id: 's1', band_id: 'h', key: 'pk', label: 'Points check', evidence_source: 'BLD-exam', answer_field: 'r', date_field: 'on' }],
    'BLD-score_point.csv': [
      { id: 'x1', criterion_id: 'c1', answer_match: 'is:ok', gate_outcome: 'pass' }, { id: 'x2', criterion_id: 'c1', answer_match: 'any', gate_outcome: 'fail' },
      { id: 'x3', criterion_id: 'c2', answer_match: 'is:ok', gate_outcome: 'pass' }, { id: 'x4', criterion_id: 'c2', answer_match: 'any', gate_outcome: 'fail' },
      { id: 'x5', criterion_id: 'j1', answer_match: 'is:Yes', points: '5' }, { id: 'x6', criterion_id: 'j1', answer_match: 'any', points: '0' },
      { id: 'x7', criterion_id: 'p1', answer_match: 'is:ok', points: '10' }, { id: 'x8', criterion_id: 'p1', answer_match: 'any', points: '0' }],
    'BLD-score_enrolment.csv': [{ id: 'e1', scheme_id: 's1', subject_id: 'f1' }, { id: 'e2', scheme_id: 's1', subject_id: 'm1' }],
    'BLD-subject.csv': [{ id: 'f1', name: 'Test Dog A', sex: 'F', dob: '2022-01-01' }, { id: 'm1', name: 'Test Dog B', sex: 'M', dob: '2022-01-01' }],
    'BLD-exam.csv': [
      { id: 'r1', subject_id: 'f1', r: 'ok', on: '2025-11-20' }, { id: 'r0', subject_id: 'f1', r: 'old', on: '2024-01-02' },
      { id: 'r2', subject_id: 'm1', r: 'ok', on: '2025-11-07' }],
    'BLD-exam2.csv': [{ id: 'q1', subject_id: 'f1', r: 'ok', on: '2026-02-03', document_id: 'FAKE-DOC' }],
    'BLD-score_judgement.csv': [{ id: 'jd1', subject_id: 'f1', criterion_id: 'look', answer: 'Yes', judged_on: '2026-09-01', judged_by: 'Owner' }]
  }, extra);
}
const TODAY = '2026-11-13';
const v = (t, more) => Object.assign({ T: t || T(), today: TODAY, esc }, more);

test('judged answers (programme and looks) reach the score: a judgement row changes the points', () => {
  const withJ = View.compute(v()).byId.f1;
  const without = View.compute(v(T({ 'BLD-score_judgement.csv': [] }))).byId.f1;
  assert.equal(withJ.lines.find((l) => l.criterion_id === 'j1').points, 5);
  assert.equal(withJ.points_earned - without.points_earned, 5);
  assert.equal(without.lines.find((l) => l.criterion_id === 'j1').unknown_reason, 'not_judged');
  // a judgement dated after the scoring day does not count yet
  const later = View.judgementsFor(T(), 'f1', T()['BLD-score_criterion.csv'], '2026-08-31');
  assert.deepEqual(later, {});
});

test('"Target x%. This dog y%." is worked out from the scheme row and the points; never when the target is in points', () => {
  const r = View.compute(v()).byId.f1;
  assert.equal(r.points_available, 15);
  assert.equal(r.points_earned, 15);
  assert.equal(View.pctLine(r), 'Target 60%. This dog 100%.');
  const m = View.compute(v()).byId.m1;
  assert.equal(View.pctLine(m), 'Target 60%. This dog ' + Math.round(100 * m.points_earned / m.points_available) + '%.');
  const pts = View.compute(v(T({ 'BLD-score_scheme.csv': [{ id: 's1', status: 'active', effective_from: '2026-01-01', target_points: '6', target_is: 'points' }] }))).byId.f1;
  assert.equal(View.pctLine(pts), '');
});

test('"n of m met" counts this animal\'s own must-pass lines: a male skipping a female-only line has a smaller m', () => {
  const c = View.compute(v());
  const band = T()['BLD-score_band.csv'][0];
  assert.equal(View.bandCount(c.byId.f1, band).text, '2 of 2 met');
  assert.equal(View.bandCount(c.byId.m1, band).text, '1 of 1 met');
  assert.equal(View.bandCount(c.byId.f1, T()['BLD-score_band.csv'][2]).text, '10 of 10');
});

test('the dog page shows the percent line, Scored on, n of m met, x of y and a To prove line on an unverified check', () => {
  View.open('score.f1');
  const t = T({ 'BLD-exam2.csv': [] });
  const html = View.page(v(t));
  View.open('');
  assert.match(html, /Target 60%\. This dog \d+%\./);
  assert.match(html, /Scored on 13 Nov 2026/);
  assert.match(html, /Section G<\/span> <span class="cnt wide bb-cnt bb-att">1 of 2 met/);
  assert.match(html, /Section B<\/span> <span class="cnt wide bb-cnt">10 of 10/);
  assert.match(html, /To prove: a dated record of Check Two/);
  assert.doesNotMatch(html, /Unproven/i);
  // a check's own proof_label names the evidence still needed
  const r = View.compute(v(T({ 'BLD-exam.csv': [] }))).byId.f1;
  assert.equal(View.toProve(r, r.lines.find((l) => l.criterion_id === 'c1')), 'To prove: a signed certificate');
});

/** The rows with Check One never due (no valid_months), so a passed Check One is done. */
function notDue(extra) {
  const t = T(extra);
  t['BLD-score_criterion.csv'] = t['BLD-score_criterion.csv'].map((c) => c.id === 'c1' ? Object.assign({}, c, { valid_months: '', due_soon_days: '' }) : c);
  return t;
}

test('done lines fold under Show done when the section also has things to do', () => {
  View.open('score.f1');
  const html = View.page(v(notDue({ 'BLD-exam2.csv': [] })));
  View.open('');
  assert.match(html, /data-bb-band="g"[\s\S]*Check Two[\s\S]*<details class="bb-done"[^>]*><summary>Show done <span class="cnt">1<\/span><\/summary>[\s\S]*Check One/);
});

test('Calendar: Due, Done and All counts (All = Due + Done); done = a valid dated record; overdue and due from the rules', () => {
  const c = View.compute(v());
  const items = View.calItems(c, TODAY);
  const n = View.calCounts(items);
  assert.equal(n.all, n.due + n.done);
  const kinds = items.map((x) => [x.dog, x.check, x.kind, x.date]);
  assert.deepEqual(kinds.filter((k) => k[1] === 'Check One'), [
    ['Test Dog B', 'Check One', 'done', '2025-11-07'], ['Test Dog B', 'Check One', 'overdue', '2026-11-07'],
    ['Test Dog A', 'Check One', 'done', '2025-11-20'], ['Test Dog A', 'Check One', 'due', '2026-11-20']].sort((a, b) => a[3].localeCompare(b[3]) || a[0].localeCompare(b[0])));
  // a never-recorded judged line is "missing": due, but with no date
  const none = View.calItems(View.compute(v(T({ 'BLD-score_judgement.csv': [] }))), TODAY).filter((x) => x.kind === 'missing');
  assert.deepEqual(none.map((x) => [x.dog, x.check, x.date]), [['Test Dog A', 'Looks answer', ''], ['Test Dog B', 'Looks answer', '']]);
});

test('the Calendar page: Due chosen first, live counts, Monday-start month, days with items are buttons, others are not', () => {
  View.setTab('cal');
  const html = View.page(v());
  View.setTab('dogs');
  assert.match(html, /<h3 class="bb-h">Calendar<\/h3><p class="bb-pts">1 due in the next 30 days/);
  assert.match(html, /data-bb-cal="due" aria-pressed="true">Due <span class="cnt">\d+[\s\S]*data-bb-cal="done"[\s\S]*data-bb-cal="all"/);
  assert.match(html, /November 2026/);
  assert.match(html, /<span>M<\/span><span>T<\/span><span>W<\/span>/);
  assert.match(html, /data-bb-day="2026-11-07"/);
  assert.match(html, /data-bb-day="2026-11-20"/);
  assert.doesNotMatch(html, /data-bb-day="2026-11-08"/);
  assert.match(html, /Test Dog B, Check One[\s\S]*Overdue/);
  View.setState({ calDay: '2026-11-20' });
  View.setTab('cal');
  const day = View.page(v());
  View.setState({ calDay: '' });
  View.setTab('dogs');
  assert.match(day, /Showing 20 Nov 2026/);
  assert.doesNotMatch(day, /Test Dog B, Check One/);
});

test('band colours and icons come from the band row; blank cells fall back to the colour word; an unknown icon is a plain mark', () => {
  const b = T()['BLD-score_band.csv'];
  assert.deepEqual(View.bandPaint(b[0]), { line: '#ee4035', light: '#ca362d', dark: '#f0625a' });
  assert.deepEqual(View.bandPaint(b[1]), { line: 'var(--ljr-7)', light: 'var(--ljr-7-icon)', dark: 'var(--ljr-7-icon)' });
  assert.deepEqual(View.bandPaint({ colour: 'pink', line_colour: 'url(x)', icon_light: 'ljr-6' }), { line: 'var(--line)', light: 'var(--ljr-6)', dark: 'var(--ljr-6)' });
  assert.equal(View.bandIcon(b[0]), View.BAND_ICON.star);
  assert.equal(View.bandIcon(b[1]), View.BAND_ICON.target);
  assert.notEqual(View.bandIcon(b[2]), View.BAND_ICON.target);
  assert.equal(View.bandIcon({ kind: 'gate' }), View.BAND_ICON.star);
  assert.equal(View.bandIcon({ kind: 'points' }), View.bandIcon(b[2]));
});

test('a list row has one section icon per must-pass or points band, grey when nothing is scored, each opening that section', () => {
  const html = View.page(v(T({ 'BLD-score_judgement.csv': [] })));
  const row = html.split('class="bb-dog bb-row"')[1];
  const icons = row.match(/class="bb-sic(?: bb-off)?"/g);
  assert.deepEqual(icons, ['class="bb-sic"', 'class="bb-sic bb-off"', 'class="bb-sic"']);
  assert.match(row, /data-go="breed\/score\.f1" data-bb-sec="f1" data-bb-band-go="g"/);
  assert.match(row, /aria-label="Section A: 0 of 5\. Open Test Dog A at Section A"/);
});

test('every tab has its own address; an animal id alone opens its Score tab', () => {
  assert.equal(View.href('cal'), 'breed/calendar');
  assert.equal(View.href('score', 'f1'), 'breed/score.f1');
  assert.equal(View.href('more', 'f1'), 'breed/more');
  View.open('calendar'); assert.equal(View.getState().tab, 'cal');
  View.open('evidence.m1'); assert.deepEqual([View.getState().tab, View.getState().dog], ['evidence', 'm1']);
  View.open('f1'); assert.deepEqual([View.getState().tab, View.getState().dog], ['score', 'f1']);
  View.open('');
  assert.equal(View.getState().tab, 'dogs');
});

test('the Score tab with no animal chosen opens the first in the list; the tabs stay on an animal page', () => {
  View.setState({ dog: '', tab: 'score' });
  const html = View.page(v());
  assert.match(html, /<h3 class="bb-dname">Test Dog A<\/h3>/);
  assert.match(html, /<nav class="bb-tabs"[\s\S]*data-bb-tab="score" data-go="breed\/score\.f1" aria-current="page"/);
  View.open('');
});

test('Evidence lists every dated record and judged answer for the animal, newest first; one record used by two checks is one item', () => {
  const c = View.compute(v());
  const items = View.evidenceItems(v(), c.byId.f1);
  assert.deepEqual(items.map((x) => [x.date, x.answer, x.checks.join('+')]), [
    ['2026-09-01', 'Yes', 'Looks answer'], ['2026-02-03', 'ok', 'Check Two'], ['2025-11-20', 'ok', 'Check One+Points check'], ['2024-01-02', 'old', 'Check One+Points check']]);
  assert.equal(items.find((x) => x.date === '2026-02-03').doc, true);
  View.open('evidence.f1');
  const html = View.page(v());
  View.setState({ evKind: 'BLD-exam' });
  const one = View.page(v());
  View.setState({ evKind: '' });
  View.open('');
  assert.match(html, /All <span class="cnt">4[\s\S]*Exam <span class="cnt">2[\s\S]*Exam2 <span class="cnt">1[\s\S]*Judged <span class="cnt">1[\s\S]*Documents <span class="cnt">1/);
  assert.match(html, /Used by: Check One, Points check/);
  assert.doesNotMatch(html, /FAKE-DOC/);
  assert.equal((one.match(/class="card bb-ev"/g) || []).length, 2);
});

test('History re-works the score as on each record date, newest first, and stores nothing', () => {
  const c = View.compute(v());
  const h = View.historyRows(v(), c.byId.f1);
  assert.deepEqual(h.map((x) => x.date), ['2026-09-01', '2026-02-03', '2025-11-20', '2024-01-02']);
  assert.equal(h[3].earned, 0);
  assert.ok(h[0].earned > h[3].earned);
  View.open('history.f1');
  const html = View.page(v());
  View.open('');
  assert.match(html, /History[\s\S]*Worked out from the records, as on each record's date\. Nothing is stored or changed\./);
  assert.match(html, /1 Sep 2026[\s\S]*Looks answer: Yes/);
});

test('More: My system, Archive with its count, History, DNA panel and Who sees what', () => {
  View.setTab('more');
  const html = View.page(v());
  View.setTab('dogs');
  assert.match(html, /My system[\s\S]*Archive<\/span><span class="cnt">0[\s\S]*History[\s\S]*DNA panel[\s\S]*Who sees what/);
});

test('the dog card section is one folded line that unfolds to must-pass first, then each points band, things to do first', () => {
  const html = View.section(v(notDue({ 'BLD-exam2.csv': [] })), 'f1');
  assert.match(html, /<details class="bb-secd"[^>]*><summary class="bb-chip bb-sechd"/);
  assert.doesNotMatch(html, /<details class="bb-secd"[^>]* open/);
  assert.match(html, /bb-secpts">15 of 15<\/span>/);
  assert.match(html, /Section G <span class="cnt wide bb-cnt">1 of 2 met[\s\S]*Check Two[\s\S]*Missing[\s\S]*Check One[\s\S]*Passed[\s\S]*Section A[\s\S]*Section B/);
  assert.match(html, /data-go="breed\/score\.f1" data-bb-sec="f1" data-bb-band-go="g"/);
  assert.doesNotMatch(html, /bb-bar/);
});

test('look: only Lexend 400, 500 and 600; the name is 16px (a Breed Better size), the score 18px; nothing under 14px', () => {
  const css = View.cssText();
  const weights = (css.match(/font-weight:\s*(\d+)/g) || []).map((x) => x.replace(/\D/g, ''));
  assert.ok(weights.length > 5);
  for (const w of weights) assert.ok(['400', '500', '600'].includes(w), 'weight ' + w);
  assert.match(css, /--bb-fs-name:16px/);
  assert.match(css, /\.bb-name\{[^}]*font-size:var\(--bb-fs-name\)/);
  assert.match(css, /\.bb-big\{[^}]*font-size:var\(--fs-figure\)/);
  for (const px of css.match(/font-size:\s*(\d+)px/g) || []) assert.ok(Number(px.replace(/\D/g, '')) >= 14, px);
  assert.doesNotMatch(css, /outline:\s*[1-9]/);
});

test('no hard-coded colours or section names in the view: every hex and section word comes from rows', () => {
  const src = fs.readFileSync(path.join(ROOT, 'breed-better', 'hub-view.js'), 'utf8');
  assert.deepEqual(src.match(/#[0-9a-fA-F]{6}\b/g) || [], []);
  assert.deepEqual(src.match(/#[0-9a-fA-F]{3}\b(?![\w-])/g) || [], []);
  for (const name of ['Programme', 'Health screening', 'Temperament', 'Breeding record', 'Fit to Breed', 'Hips', 'Elbows', 'Patella']) {
    assert.doesNotMatch(src, new RegExp("'" + name, 'i'), name + ' must come from rows');
  }
  assert.doesNotMatch(src, /Unproven/i);
  assert.doesNotMatch(src, /DNA Kit/);
});

test('mustPassFor gives an inspector the must-pass words, answer, date and due date only', () => {
  const r = View.compute(v()).byId.f1;
  const mp = View.mustPassFor(r);
  assert.deepEqual(mp.map((x) => [x.label, x.outcome]), [['Check One', 'pass'], ['Check Two', 'pass']]);
  for (const x of mp) assert.deepEqual(Object.keys(x).sort(), ['answer', 'date', 'due_date', 'evidence_id', 'evidence_table', 'label', 'outcome', 'subject_id']);
});

test('viewer levels: a placeholder set; the inspector default shows must-pass words; points, target and ranking never', () => {
  const set = Levels.levels({}, TODAY);
  assert.equal(set.placeholder, true);
  assert.deepEqual(set.viewers.map((w) => w.type), ['inspector', 'vet', 'breeder']);
  const ins = Levels.showsFor({}, 'inspector', TODAY), vet = Levels.showsFor({}, 'vet', TODAY);
  assert.equal(ins.must_pass, true);
  assert.equal(!!vet.must_pass, false);
  // rows can choose levels, but never widen past what an outside viewer may see
  const rows = { 'BLD-viewer_level.csv': [{ viewer_type: 'breeder', viewer_label: 'Another breeder', level_key: 'wide', level_label: 'Wide', shows: 'records;must_pass;points;target;ranking;notes' }] };
  const wide = Levels.showsFor(rows, 'breeder', TODAY);
  assert.deepEqual(Object.keys(wide).sort(), ['must_pass', 'records']);
  const line = { label: 'Check One', outcome: 'pass', answer: 'ok', date: '2025-11-20', due_date: '2026-11-20', points: 10, target: 6 };
  assert.deepEqual(Levels.trimLines([line], ins), [{ label: 'Check One', outcome: 'pass', answer: 'ok', date: '2025-11-20', due_date: '2026-11-20' }]);
  assert.deepEqual(Levels.trimLines([line], vet), [{ label: 'Check One', answer: 'ok', date: '2025-11-20', due_date: '2026-11-20' }]);
  assert.deepEqual(Levels.trimLines([line], { records: true }), [{ label: 'Check One' }]);
  View.setTab('viewers');
  const html = View.page(v());
  View.setTab('dogs');
  assert.match(html, /placeholder set/);
  assert.match(html, /data-bb-viewer="inspector"[\s\S]*Level B[\s\S]*data-on="true"[^>]*>[\s\S]*Pass, Unverified or Fail/);
  assert.match(html, /Points<\/li>/);
  assert.doesNotMatch(html.split('data-bb-viewer="inspector"')[1].split('data-bb-viewer="vet"')[0], /data-on="true"[^>]*>(?:(?!<\/li>).)*Points</);
});

test('DNA panel: grade-to-colour bands come from rows; each band colour follows its level, tested with invented grades', () => {
  const t = {
    'BLD-grade_band.csv': [
      { test: 'hips', test_label: 'Hips', scale: 'total, 0 to 106', grade_match: 'range:0-10', level: 'good', label: '0 to 10', sort_order: '1' },
      { test: 'hips', grade_match: 'range:11-18', level: 'watch', label: '11 to 18', sort_order: '2' },
      { test: 'hips', grade_match: 'range:19-106', level: 'poor', label: '19+', sort_order: '3' },
      { test: 'eyes', grade_match: 'is:Unaffected', level: 'good', label: 'Unaffected', sort_order: '4' },
      { test: 'eyes', grade_match: 'is:Affected', level: 'poor', label: 'Affected', sort_order: '5', to_date: '2020-01-01' }],
    'BLD-health_screen.csv': [{ subject_id: 'f1', test: 'hips', grade: '12', tested_on: '2025-01-02' }, { subject_id: 'f1', test: 'hips', grade: '4', tested_on: '2024-01-02' }, { subject_id: 'f1', test: 'eyes', grade: 'Unaffected', tested_on: '2025-03-02' }]
  };
  assert.equal(Dna.bandFor(t, 'hips', '4', TODAY).level, 'good');
  assert.equal(Dna.bandFor(t, 'hips', '12', TODAY).level, 'watch');
  assert.equal(Dna.bandFor(t, 'hips', '40', TODAY).level, 'poor');
  assert.equal(Dna.bandFor(t, 'eyes', 'Affected', TODAY), null);
  assert.equal(Dna.bandFor(t, 'elbows', '0', TODAY), null);
  const g = Dna.grades(t, 'f1');
  assert.deepEqual(g.map((x) => [x.test, x.grade, x.band && x.band.level]), [['Hips', '12', 'watch'], ['eyes', 'Unaffected', 'good']]);
  const card = Dna.card(t, 'f1', esc);
  assert.match(card, /DNA panel/);
  assert.match(card, /data-level="watch" style="border-color:var\(--ljr-3\)"/);
  assert.match(card, /data-level="good" style="border-color:var\(--ljr-5\)"/);
  const screen = Dna.screen(t, {}, esc, TODAY);
  assert.match(screen, /Grade to colour[\s\S]*Hips[\s\S]*total, 0 to 106[\s\S]*0 to 10[\s\S]*11 to 18[\s\S]*19\+/);
  assert.match(screen, /Set-up/);
  assert.doesNotMatch(screen, /DNA Kit/);
});

test('every screen says DNA panel, never DNA Kit', () => {
  for (const f of ['breed-better/hub-view.js', 'breed-better/dna-panel.js', 'cdhub/index.html']) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), 'utf8'), /DNA Kit|dna-kit|BBDnaKit/, f);
  }
});
