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
// The months the fold offers: this month (London) back to the first record, newest first.
const offered = (first) => {
  const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }).slice(0, 7), out = [];
  let [y, m] = now.split('-').map(Number), k = now;
  for (;;) { out.push(k); if (k <= first) break; m -= 1; if (m < 1) { m = 12; y -= 1; } k = y + '-' + String(m).padStart(2, '0'); }
  return out;
};
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const label = (k, n) => MON3[Number(k.slice(5)) - 1] + ' ' + k.slice(0, 4) + ' (' + (n || 'none') + ')';
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

  test('CSV: free text that starts = + - @ tab or return cannot run as a formula, in any column', () => {
    const bad = ['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'];
    const rows = bad.map((v, i) => ({ id: 'b' + i, subject_id: 'sub-test-dog-1', given_on: '2026-06-0' + (i + 1), product: v, reason: v, note: v }));
    const csv = R.toCsv({ kennel: '=Kennel', month: '2026-06', printed: '' }, R.build(rows, { month: '2026-06', dog }));
    const cells = csv.replace(/^\ufeff/, '').split('\r\n').slice(6, 12).map((r) => r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')));
    cells.forEach((r, i) => {
      [4, 9, 12].forEach((col) => {   // Medicine, Reason, Note
        // = + - @ get a leading '; a leading tab or return is trimmed off with the other spaces
        expect(r[col]).toBe(/^[\t\r]/.test(bad[i]) ? bad[i].trim() : "'" + bad[i]);
        expect(r[col]).not.toMatch(/^[=+\-@\t\r]/);
      });
    });
    expect(csv).toContain("Medicines register,'=Kennel");
  });

  test('CSV: UTF-8 with a BOM, and dates as YYYY-MM-DD', () => {
    const csv = R.toCsv({ kennel: 'Café Kennel £', month: '2026-02', printed: '' }, R.build(ROWS, { month: '2026-02', dog }));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(Buffer.from(csv, 'utf8').subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(csv).toContain('Café Kennel £');
    expect(csv).toContain('\r\n2026-02-03,not recorded,Test Dog One,');
    expect(csv).not.toContain('3 Feb 2026');
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
  test('pick a month, download the CSV and open the print page; nothing is written', async ({ page, guard, context }) => {
    setFile(guard.world, 'BLD-dispense.csv', DISPENSE);
    setFile(guard.world, 'BLD-microchip.csv', CHIPS);
    await context.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="compliance"]');
    const card = page.locator('#compMeds');
    await expect(card.locator('details')).toHaveAttribute('open', '');   // Compliance folds start open
    const month = card.locator('#medsMonth');
    const counts = { '2026-02': 3, '2026-03': 1 };
    await expect(month.locator('option')).toHaveText(offered('2026-02').map((k) => label(k, counts[k])));
    await month.selectOption('2026-02');

    const [dl] = await Promise.all([page.waitForEvent('download'), card.locator('#medsCsv').click()]);
    expect(dl.suggestedFilename()).toBe('medicines-register-2026-02.csv');
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    expect(csv).toContain('Medicines register,Sample Kennel (invented)');
    expect(csv).toContain('Month,February 2026');
    expect(csv).toContain('2026-02-03,not recorded,Test Dog One,900000000000001,Sample Wormer,not recorded,not recorded,1 tablet,Oral,routine,not recorded,not recorded,with food');
    expect(csv).toContain('sub-not-on-list (not on the current list)');
    await expect(card.locator('#medsMsg')).toHaveText('Downloaded 3 entries.');

    await page.waitForFunction(() => !!window.BLDMedsRegister);   // fetched when Compliance opens
    const [pop] = await Promise.all([context.waitForEvent('page'), card.locator('#medsPrint').click()]);
    await expect(pop).toHaveURL(/cdhub\/meds-print\.html$/);
    await expect.poll(() => pop.evaluate(() => window.__printed || 0)).toBe(1);   // the print dialog opens once
    await pop.waitForTimeout(800);
    expect(await pop.evaluate(() => window.__printed)).toBe(1);   // and not twice
    await expect(pop.locator('h1')).toHaveText('Medicines register · February 2026');
    await expect(pop.locator('tbody tr')).toHaveCount(3);
    await expect(pop.locator('.meta').first()).toContainText('Sample Kennel (invented)');
    await expect(pop.locator('.gaps')).toContainText('Batch 3 of 3');
    await expect(card.locator('#medsMsg')).toHaveText('Opened 3 entries to print.');
    await pop.close();
  });

  test('a month with nothing given prints and downloads a nil record', async ({ page, guard, context }) => {
    setFile(guard.world, 'BLD-dispense.csv', DISPENSE);
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="compliance"]');
    const card = page.locator('#compMeds');
    // April 2026 had no medicine: it is offered all the same
    await expect(card.locator('#medsMonth option[value="2026-04"]')).toHaveText('Apr 2026 (none)');
    await card.locator('#medsMonth').selectOption('2026-04');
    await page.waitForFunction(() => !!window.BLDMedsRegister);   // fetched when Compliance opens
    const [pop] = await Promise.all([context.waitForEvent('page'), card.locator('#medsPrint').click()]);
    await expect(pop.locator('h1')).toHaveText('Medicines register · April 2026');
    await expect(pop.locator('body')).toContainText('No medicine recorded in April 2026.');
    await expect(pop.locator('.meta').first()).toContainText('Entries: 0');
    await pop.close();
    const [dl] = await Promise.all([page.waitForEvent('download'), card.locator('#medsCsv').click()]);
    const csv = fs.readFileSync(await dl.path(), 'utf8').replace(/^\ufeff/, '').trim().split('\r\n');
    expect(csv[1]).toBe('Month,April 2026');
    expect(csv[csv.length - 1]).toBe(R.COLUMNS.map((c) => c[1]).join(','));   // the header row and no lines
    await expect(card.locator('#medsMsg')).toHaveText('Downloaded 0 entries.');
  });

  test('no medicine on file at all: this month is still offered, as a nil record', async ({ page, guard, context }) => {
    setFile(guard.world, 'BLD-dispense.csv', 'id,subject_id,given_on,product\n');
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="compliance"]');
    const now = offered('9999-99')[0];
    await expect(page.locator('#medsMonth option')).toHaveText([label(now, 0)]);
    await page.waitForFunction(() => !!window.BLDMedsRegister);   // fetched when Compliance opens
    const [pop] = await Promise.all([context.waitForEvent('page'), page.locator('#medsPrint').click()]);
    await expect(pop.locator('body')).toContainText('No medicine recorded in ' + MONTH[Number(now.slice(5)) - 1] + ' ' + now.slice(0, 4) + '.');
    await pop.close();
  });

  test('the print page opened on its own says where to go, and shows nothing', async ({ page }) => {
    await page.goto('cdhub/meds-print.html');
    await expect(page.locator('#medsPrintNone')).toContainText('Open this from CD Hub: Compliance, Medicines register, then Print.');
    await expect(page.locator('table')).toHaveCount(0);
  });
});
