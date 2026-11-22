// Checks register (priority 2, 21 Nov 2026): Compliance prints or downloads one month of check records for an inspector.
// Read only. A detail the record does not hold says "not recorded"; a correction never hides the original; a later
// note is the action taken. Invented rows only; nothing is posted.
const fs = require('fs');
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');
const R = require('../../cdhub/checks-register.js');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const setFile = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-extra-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const parse = (text) => {
  const lines = text.trim().split('\n'), h = lines[0].split(',');
  return lines.slice(1).map((l) => { const v = l.split(','), o = {}; h.forEach((k, i) => { o[k] = v[i] || ''; }); return o; });
};

const TYPES = [
  'id,tenant_id,type_key,label,target,active,effective_from,source,every_days',
  'ct-feed,ten-test,feed,Feeding,dog,true,2026-01-01,invented,1',
  'ct-clean,ten-test,clean,Clean the room,area,true,2026-01-01,invented,1',
  'ct-fire,ten-test,fire,Fire exits clear,site,true,2026-01-01,invented,1',
].join('\n') + '\n';
const H = 'id,tenant_id,check_type_id,area_id,subject_id,item,amount,outcome,happened_at,note,taken_at,taken_by,corrects_id,photo,how_recorded,litter_id,note_for_id,item_id,time_given';
const LOGS = [H,
  'cl-1,ten-test,ct-feed,,sub-test-dog-1,Sample kibble,200 g,ok,2026-02-03T08:05:00Z,,2026-02-03T08:06:00Z,Sample Staff A,,,tapped,,,,',
  'cl-2,ten-test,ct-clean,area-1,,,,concern,2026-02-03T09:00:00Z,Drain blocked,2026-02-03T09:01:00Z,Sample Staff A,,,tapped,,,,',
  'cl-3,ten-test,ct-clean,,,,,note,2026-02-03T15:30:00Z,Drain cleared and room re-cleaned,2026-02-03T15:30:00Z,Sample Staff B,,,typed,,cl-2,,',
  'cl-4,ten-test,ct-fire,,,,,ok,2026-02-04T07:00:00Z,,2026-02-05T18:00:00Z,Sample Staff B,,,paper,,,,false',
  'cl-5,ten-test,ct-feed,,sub-test-dog-2,,,not_done,2026-02-05T08:00:00Z,,2026-02-05T08:00:00Z,Sample Staff A,,,tapped,,,,',
  'cl-6,ten-test,ct-feed,,sub-test-dog-2,Sample kibble,180 g,ok,2026-02-05T08:00:00Z,Was fed; wrong button,2026-02-05T10:00:00Z,Sample Staff A,cl-5,,typed,,,,',
  'cl-7,ten-test,ct-feed,,sub-test-dog-1,,,ok,2026-03-01T08:00:00Z,,2026-03-01T08:00:00Z,Sample Staff A,,,tapped,,,,',
].join('\n') + '\n';
const types = parse(TYPES), logs = parse(LOGS);
const NAMES = { 'sub-test-dog-1': 'Test Dog One', 'sub-test-dog-2': 'Test Dog Two', 'area-1': 'Test Cabin A' };
const subject = (r) => [NAMES[r.subject_id], NAMES[r.area_id]].filter(Boolean).join(', ') || (r.subject_id || r.area_id ? '' : 'Whole site');
const byId = (lines, id) => lines.find((l) => l.id === id);

test.describe('Checks register: the rules', () => {
  test('months with a record, newest first; a note added later is not a record of its own', () => {
    expect(R.months(logs)).toEqual(['2026-03', '2026-02']);
    const lines = R.build(logs, { month: '2026-02', types, subject });
    expect(lines.map((l) => l.id)).toEqual(['cl-1', 'cl-2', 'cl-4', 'cl-5', 'cl-6']);
  });

  test('a record prints every column in UK time; detail is item and amount', () => {
    const l = byId(R.build(logs, { month: '2026-02', types, subject }), 'cl-1');
    expect(R.COLUMNS.map((c) => R.cell(l, c[0]))).toEqual(['3 Feb 2026', '08:05', 'Feeding', 'Test Dog One', 'done', 'Sample kibble, 200 g', '', '', 'Sample Staff A', 'tapped', '']);
  });

  test('a concern: action taken is the note at the time plus the note added later, labelled', () => {
    const l = byId(R.build(logs, { month: '2026-02', types, subject }), 'cl-2');
    expect(R.cell(l, 'result')).toBe('concern');
    expect(R.cell(l, 'action')).toBe('At the time: Drain blocked | Later, 3 Feb 2026 15:30, by Sample Staff B: Drain cleared and room re-cleaned');
  });

  test('not done with no note: action taken says not recorded', () => {
    const l = byId(R.build(logs, { month: '2026-02', types, subject }), 'cl-5');
    expect(R.cell(l, 'action')).toBe(R.NR);
  });

  test('a correction is its own line and the original stays, each pointing at the other', () => {
    const lines = R.build(logs, { month: '2026-02', types, subject });
    expect(R.cell(byId(lines, 'cl-5'), 'result')).toBe('not done');
    expect(R.cell(byId(lines, 'cl-5'), 'correction')).toBe('Corrected on 5 Feb 2026 08:00 by Sample Staff A (now done)');
    expect(R.cell(byId(lines, 'cl-6'), 'correction')).toBe('Corrects the record of 5 Feb 2026 08:00 (was not done)');
  });

  test('a time the default filled in prints "time not recorded"; a whole-site check names the site', () => {
    const l = byId(R.build(logs, { month: '2026-02', types, subject }), 'cl-4');
    expect(R.cell(l, 'time')).toBe(R.NO_TIME);
    expect(R.cell(l, 'subject')).toBe('Whole site');
    expect(R.cell(l, 'how')).toBe('entered later from paper');
  });

  test('one check type only', () => {
    expect(R.build(logs, { month: '2026-02', types, subject, typeId: 'ct-clean' }).map((l) => l.id)).toEqual(['cl-2']);
  });

  test('UK time: a record at 23:30 UTC in summer is the next day in the register', () => {
    const [l] = R.build([{ id: 'x', check_type_id: 'ct-feed', outcome: 'ok', happened_at: '2026-06-30T23:30:00Z' }], { month: '2026-07', types, subject });
    expect(R.cell(l, 'date', true)).toBe('2026-07-01');
    expect(R.cell(l, 'time')).toBe('00:30');
  });

  test('CSV: BOM, header lines, YYYY-MM-DD dates, formula cells made harmless', () => {
    const evil = logs.concat([{ id: 'ev', check_type_id: 'ct-feed', outcome: 'concern', happened_at: '2026-02-09T08:00:00Z', note: '=HYPERLINK("x")', item: '+1', amount: '@A1', taken_by: '-x' }]);
    const csv = R.toCsv({ kennel: 'Sample Kennel', month: '2026-02', which: 'All checks', printed: '21 Nov 2026 10:00' }, R.build(evil, { month: '2026-02', types, subject }));
    expect(Buffer.from(csv, 'utf8').subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const rows = csv.replace(/^﻿/, '').split('\r\n');
    expect(rows.slice(0, 4)).toEqual(['Checks register,Sample Kennel', 'Month,February 2026', 'Checks,All checks', 'Printed,21 Nov 2026 10:00']);
    expect(rows[6]).toBe(R.COLUMNS.map((c) => c[1]).join(','));
    expect(rows[7].startsWith('2026-02-03,08:05,Feeding,Test Dog One,done,')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("'-x");
    expect(csv).not.toMatch(/,[=+\-@][^,]/);
  });

  test('print: kennel, month, every column, the gaps counted; an empty month says so', () => {
    const lines = R.build(logs, { month: '2026-02', types, subject });
    const html = R.reportHtml({ kennel: 'Sample <Kennel>', month: '2026-02', printed: 'x' }, lines);
    expect(html).toContain('Checks register · February 2026');
    expect(html).toContain('Sample &lt;Kennel&gt;');
    R.COLUMNS.forEach((c) => expect(html).toContain('<th scope="col">' + c[1] + '</th>'));
    expect(html).toContain('Time 1 of 5');
    expect(html).toContain('Action taken 1 of 5');
    expect(R.reportHtml({ kennel: 'K', month: '2026-04', printed: '' }, [])).toContain('No checks recorded in April 2026.');
  });
});

test.describe('CD Hub: Checks register on Compliance', () => {
  test('pick a month, download the CSV and print it in the page; nothing is written', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-check_type.csv', TYPES);
    setFile(guard.world, 'BLD-check_log.csv', LOGS);
    await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="compliance"]');
    const card = page.locator('#compChecksReg');
    await expect(card.locator('details')).toHaveAttribute('open', '');
    await expect(card.locator('#ckrMonth option[value="2026-02"]')).toHaveText('Feb 2026 (5)');
    await expect(card.locator('#ckrMonth option[value="2026-04"]')).toHaveText('Apr 2026 (none)');
    await card.locator('#ckrMonth').selectOption('2026-02');

    const [dl] = await Promise.all([page.waitForEvent('download'), card.locator('#ckrCsv').click()]);
    expect(dl.suggestedFilename()).toBe('checks-register-2026-02.csv');
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    expect(csv).toContain('Checks register,Sample Kennel (invented)');
    expect(csv).toContain('2026-02-03,09:00,Clean the room,Test Cabin A,concern,,Drain blocked,"At the time: Drain blocked | Later, 3 Feb 2026 15:30, by Sample Staff B: Drain cleared and room re-cleaned",Sample Staff A,tapped,');
    expect(csv).toContain('time not recorded,Fire exits clear,Whole site');
    await expect(card.locator('#ckrMsg')).toHaveText('Downloaded 5 entries.');

    await page.waitForFunction(() => !!window.BLDChecksRegister);
    await card.locator('#ckrType').selectOption({ label: 'Clean the room' });
    await card.locator('#ckrPrint').click();
    await expect.poll(() => page.evaluate(() => window.__printed || 0)).toBe(1);
    const rep = page.locator('#ckrReport');
    await expect(rep.locator('h1')).toHaveText('Checks register · February 2026');
    await expect(rep.locator('.meta').first()).toContainText('Checks: Clean the room');
    await expect(rep.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('body')).toHaveClass(/ckr-printing/);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('body')).not.toHaveClass(/ckr-printing/);
    await expect(rep).toBeHidden();   // only on paper
  });

  test('a month with no checks prints a nil record', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-check_type.csv', TYPES);
    setFile(guard.world, 'BLD-check_log.csv', LOGS);
    await page.addInitScript(() => { window.print = () => {}; });
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="compliance"]');
    await page.locator('#ckrMonth').selectOption('2026-04');
    await page.waitForFunction(() => !!window.BLDChecksRegister);
    await page.locator('#ckrPrint').click();
    await expect(page.locator('#ckrReport')).toContainText('No checks recorded in April 2026.');
  });
});
