// Medicines register (priority 2, 21 Nov 2026): Compliance prints or downloads one month of medicines for an inspector.
// Read only. A detail the record does not hold says "not recorded", never a guess. Invented rows only; nothing is posted.
const fs = require('fs');
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');
const R = require('../../cdhub/meds-register.js');

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

const DISPENSE = [
  'id,tenant_id,subject_id,given_on,product,presentation,dose_volume,weight_band,weight_kg_used,dosage_basis,route,reason,source,ruling_needed,note',
  'dsp-1,ten-test,sub-test-dog-1,2026-02-03,Sample Wormer,,1 tablet,,,,Oral,routine,invented,,with food',
  'dsp-2,ten-test,sub-test-dog-2,2026-02-01,NOT STATED,,,,,,,,invented,,',
  'dsp-3,ten-test,sub-not-on-list,2026-02-10,Sample Drops,,2 drops,,,,Topical,ear,invented,,',
  'dsp-4,ten-test,sub-test-dog-1,2026-03-01,Sample Wormer,,1 tablet,,,,Oral,routine,invented,,',
].join('\n') + '\n';
const CHIPS = 'id,subject_id,chip_number\nmc-1,sub-test-dog-1,900000000000001\n';
const ROWS = DISPENSE.trim().split('\n').slice(1).map((l) => {
  const h = DISPENSE.split('\n')[0].split(','), v = l.split(','), o = {};
  h.forEach((k, i) => { o[k] = v[i] || ''; });
  return o;
});
const DOGS = { 'sub-test-dog-1': { name: 'Test Dog One', chip: '900000000000001' }, 'sub-test-dog-2': { name: 'Test Dog Two', chip: '' } };
const dog = (sid) => DOGS[sid] || null;

test.describe('Medicines register: the rules', () => {
  test('months with a record, newest first', () => {
    expect(R.months(ROWS)).toEqual(['2026-03', '2026-02']);
  });

  test('one month, oldest first; a missing detail is "not recorded", never filled in', () => {
    const lines = R.build(ROWS, { month: '2026-02', dog });
    expect(lines.map((l) => l.id)).toEqual(['dsp-2', 'dsp-1', 'dsp-3']);
    const one = lines[1];
    expect(R.cell(one, 'date')).toBe('3 Feb 2026');
    expect(R.cell(one, 'dog')).toBe('Test Dog One');
    expect(R.cell(one, 'chip')).toBe('900000000000001');
    expect(R.cell(one, 'product')).toBe('Sample Wormer');
    expect(R.cell(one, 'dose')).toBe('1 tablet');
    expect(R.cell(one, 'reason')).toBe('routine');
    expect(R.cell(one, 'note')).toBe('with food');
    // BLD-dispense holds none of these today: each says so
    ['time', 'batch', 'expiry', 'vet', 'given_by'].forEach((k) => expect(R.cell(one, k)).toBe(R.NR));
    // "NOT STATED" is not a medicine's name
    expect(R.cell(lines[0], 'product')).toBe(R.NR);
    expect(R.cell(lines[0], 'dose')).toBe(R.NR);
    // a dog no longer on the list keeps its id, and no chip is guessed
    expect(R.cell(lines[2], 'dog')).toBe('sub-not-on-list (not on the current list)');
    expect(R.cell(lines[2], 'chip')).toBe(R.NR);
  });

  test('a time, batch, expiry, vet instruction and who gave it print when the record holds them', () => {
    const [l] = R.build([{ id: 'x', subject_id: 'sub-test-dog-1', given_at: '2026-04-02T08:15:00Z', product: 'Sample Tablet',
      batch: 'B-123', expires_on: '2027-01-31', amount: '5 ml', route: 'Oral', reason: 'skin', instructions: 'twice a day for 5 days', given_by: 'Sample Staff' }],
    { month: '2026-04', dog });
    expect(R.cell(l, 'time')).toBe('08:15');
    expect(R.cell(l, 'batch')).toBe('B-123');
    expect(R.cell(l, 'expiry')).toBe('2027-01-31');
    expect(R.cell(l, 'dose')).toBe('5 ml');
    expect(R.cell(l, 'vet')).toBe('twice a day for 5 days');
    expect(R.cell(l, 'given_by')).toBe('Sample Staff');
    expect(l.missing).toEqual([]);
  });

  test('CSV: header lines, every column, formulas made harmless', () => {
    const lines = R.build(ROWS.concat([{ id: 'evil', subject_id: 'sub-test-dog-1', given_on: '2026-02-20', product: '=HYPERLINK("x")' }]), { month: '2026-02', dog });
    const csv = R.toCsv({ kennel: 'Sample Kennel', month: '2026-02', printed: '21 Nov 2026 10:00' }, lines);
    const rows = csv.replace(/^﻿/, '').split('\r\n');
    expect(rows[0]).toBe('Medicines register,Sample Kennel');
    expect(rows[1]).toBe('Month,February 2026');
    expect(rows[2]).toBe('Printed,21 Nov 2026 10:00');
    expect(rows[5]).toBe(R.COLUMNS.map((c) => c[1]).join(','));
    expect(rows.length).toBe(6 + 4 + 1);   // 6 header rows, 4 lines, final blank
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toMatch(/,=HYPERLINK/);
    expect(R.fileName('2026-02')).toBe('medicines-register-2026-02.csv');
  });

  test('print page: kennel, month, printed date, every column, the gaps counted', () => {
    const lines = R.build(ROWS, { month: '2026-02', dog });
    const html = R.toHtml({ kennel: 'Sample <Kennel>', month: '2026-02', printed: '21 Nov 2026 10:00' }, lines);
    expect(html).toContain('<title>Medicines register · February 2026</title>');
    expect(html).toContain('Sample &lt;Kennel&gt;');
    R.COLUMNS.forEach((c) => expect(html).toContain('<th scope="col">' + c[1] + '</th>'));
    expect(html).toContain('Batch 3 of 3');
    expect(html).toContain('Given by 3 of 3');
    expect(R.toHtml({ kennel: 'K', month: '2026-05', printed: '' }, [])).toContain('No medicine recorded in May 2026.');
  });
});

test.describe('CD Hub: Medicines register on Compliance', () => {
  test('pick a month, download the CSV and open the print page; nothing is written @regression', async ({ page, guard, context }) => {
    setFile(guard.world, 'BLD-dispense.csv', DISPENSE);
    setFile(guard.world, 'BLD-microchip.csv', CHIPS);
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="compliance"]');
    const card = page.locator('#compMeds');
    await expect(card.locator('details')).toHaveAttribute('open', '');   // Compliance folds start open
    const month = card.locator('#medsMonth');
    await expect(month.locator('option')).toHaveText(['Mar 2026 (1)', 'Feb 2026 (3)']);
    await month.selectOption('2026-02');

    const [dl] = await Promise.all([page.waitForEvent('download'), card.locator('#medsCsv').click()]);
    expect(dl.suggestedFilename()).toBe('medicines-register-2026-02.csv');
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    expect(csv).toContain('Medicines register,Sample Kennel (invented)');
    expect(csv).toContain('Month,February 2026');
    expect(csv).toContain('3 Feb 2026,not recorded,Test Dog One,900000000000001,Sample Wormer,not recorded,not recorded,1 tablet,Oral,routine,not recorded,not recorded,with food');
    expect(csv).toContain('sub-not-on-list (not on the current list)');
    await expect(card.locator('#medsMsg')).toHaveText('Downloaded 3 entries.');

    const [pop] = await Promise.all([context.waitForEvent('page'), card.locator('#medsPrint').click()]);
    await expect(pop.locator('h1')).toHaveText('Medicines register · February 2026');
    await expect(pop.locator('tbody tr')).toHaveCount(3);
    await expect(pop.locator('.meta').first()).toContainText('Sample Kennel (invented)');
    await expect(pop.locator('.gaps')).toContainText('Batch 3 of 3');
    await expect(card.locator('#medsMsg')).toHaveText('Opened 3 entries to print.');
    await pop.close();
  });

  test('no medicine on file: the fold says so and offers nothing to print', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-dispense.csv', 'id,subject_id,given_on,product\n');
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="compliance"]');
    await expect(page.locator('#medsNone')).toHaveText('No medicine recorded yet.');
    await expect(page.locator('#medsPrint')).toHaveCount(0);
  });
});
