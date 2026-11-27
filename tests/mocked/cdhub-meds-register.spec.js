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
  'dsp-1,ten-test,sub-test-dog-1,2026-02-03,Med C,,1 tablet,,,,Oral,routine,invented,,with food',
  'dsp-2,ten-test,sub-test-dog-2,2026-02-01,NOT STATED,,,,,,,,invented,,',
  'dsp-3,ten-test,sub-not-on-list,2026-02-10,Sample Drops,,2 drops,,,,Topical,ear,invented,,',
  'dsp-4,ten-test,sub-test-dog-1,2026-03-01,Med C,,1 tablet,,,,Oral,routine,invented,,',
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
    expect(R.cell(one, 'product')).toBe('Med C');
    expect(R.cell(one, 'dose')).toBe('1 tablet');
    expect(R.cell(one, 'reason')).toBe('routine');
    expect(R.cell(one, 'note')).toBe('with food');
    // Dose is required. A blank name shows Lisa Carson. Time, batch, expiry and the vet note are left blank.
    expect(R.cell(one, 'given_by')).toBe('Lisa Carson');
    ['time', 'batch', 'expiry', 'vet'].forEach((k) => expect(R.cell(one, k)).toBe(''));
    // "NOT STATED" is not a medicine's name
    expect(R.cell(lines[0], 'product')).toBe(R.NR);
    expect(R.cell(lines[0], 'dose')).toBe(R.NR);
    // a dog no longer on the list keeps its id, and no chip is guessed
    expect(R.cell(lines[2], 'dog')).toBe('Dog not on the current list');   // no id on paper
    expect(R.cell(lines[2], 'chip')).toBe('');
  });

  test('a time, batch, expiry, vet instruction and who gave it print when the record holds them', () => {
    const [l] = R.build([{ id: 'x', subject_id: 'sub-test-dog-1', given_at: '2026-04-02T08:15:00Z', product: 'Sample Tablet',
      batch: 'B-123', expires_on: '2027-01-31', amount: '5 ml', route: 'Oral', reason: 'skin', instructions: 'twice a day for 5 days', given_by: 'Sample Staff' }],
    { month: '2026-04', dog });
    expect(R.cell(l, 'time')).toBe('09:15');   // 08:15 UTC is 09:15 UK summer time
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
    expect(csv).toContain('\r\n2026-02-03,,Test Dog One,');
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
    expect(html).not.toContain('Batch 3 of 3');
    expect(html).not.toContain('Recorded in');
    expect(html).not.toContain('dog card');
    expect(html).toContain('Lisa Carson');
    expect(R.toHtml({ kennel: 'K', month: '2026-05', printed: '' }, [])).toContain('No records this month.');
  });
});

const JOB_TYPES = [
  { id: 'ct-med', type_key: 'medicine', label: 'Medicine given', amount_unit: 'dose' },
  { id: 'ct-feed', type_key: 'feeding', label: 'Feeding', amount_unit: 'g' },
];
const JOB_LOGS = [
  { id: 'j1', check_type_id: 'ct-med', subject_id: 'sub-test-dog-1', item: 'Sample Drops', amount: '2', outcome: 'ok', happened_at: '2026-02-04T08:15:00Z', taken_by: 'Sample Staff A' },
  { id: 'j2', check_type_id: 'ct-med', subject_id: 'sub-test-dog-2', item: '', amount: '', outcome: 'not_done', happened_at: '2026-02-06T08:00:00Z', taken_by: 'Sample Staff B', note: 'Refused' },
  { id: 'j3', check_type_id: 'ct-med', subject_id: 'sub-test-dog-2', outcome: 'note', note_for_id: 'j2', note: 'Vet told by phone', taken_by: 'Sample Staff A', taken_at: '2026-02-06T12:00:00Z' },
  { id: 'j4', check_type_id: 'ct-med', subject_id: 'sub-test-dog-1', item: 'Sample Drops', amount: '1 dose', outcome: 'ok', happened_at: '2026-02-07T07:00:00Z', time_given: 'false', taken_by: 'Sample Staff A' },
  { id: 'j5', check_type_id: 'ct-feed', subject_id: 'sub-test-dog-1', item: 'Sample kibble', amount: '200', outcome: 'ok', happened_at: '2026-02-04T08:00:00Z' },
  { id: 'j6', check_type_id: 'ct-med', subject_id: 'sub-test-dog-1', item: 'Sample Drops', amount: '3', outcome: 'ok', happened_at: '2026-02-04T08:15:00Z', taken_by: 'Sample Staff A', corrects_id: 'j1', note: 'Was 3 drops' },
];

test.describe('Medicines register: the staff "Medicine given" job counts too', () => {
  test('job records join the register; feeding and notes added later do not become lines', () => {
    const all = ROWS.concat(R.fromChecks(JOB_LOGS, JOB_TYPES));
    const lines = R.build(all, { month: '2026-02', dog });
    expect(lines.map((l) => l.id)).toEqual(['dsp-2', 'dsp-1', 'j1', 'j6', 'j2', 'j4', 'dsp-3']);
    const j1 = lines.find((l) => l.id === 'j1');
    expect(R.COLUMNS.map((c) => R.cell(j1, c[0]))).toEqual(['4 Feb 2026', '08:15', 'Test Dog One', '900000000000001', 'Sample Drops',
      '', '', '2 dose', '', '', '', 'Sample Staff A', 'Corrected by a later record.']);
    expect(R.COLUMNS.some((c) => c[0] === 'source')).toBe(false);
    expect(lines.find((l) => l.id === 'dsp-1').source).toBe('dog card');
  });

  test('not done says so with its note and the note added later; a default time is "time not recorded"; a correction says what it corrects', () => {
    const lines = R.build(R.fromChecks(JOB_LOGS, JOB_TYPES), { month: '2026-02', dog });
    const get = (id) => lines.find((l) => l.id === id);
    expect(R.cell(get('j2'), 'note')).toBe('Job marked not done. Refused Later, by Sample Staff A: Vet told by phone');
    expect(R.cell(get('j2'), 'product')).toBe(R.NR);
    expect(R.cell(get('j4'), 'time')).toBe('');
    expect(R.cell(get('j4'), 'dose')).toBe('1 dose');
    expect(R.cell(get('j6'), 'note')).toBe('Was 3 drops Corrects the record of 2026-02-04.');
    expect(R.cell(get('j1'), 'date')).toBe('4 Feb 2026');
  });

  test('a dose typed from paper or imported says how it was recorded; a late save is never marked late @regression', () => {
    const logs = [
      { id: 'k1', check_type_id: 'ct-med', subject_id: 'sub-test-dog-1', item: 'Sample Drops', amount: '2', outcome: 'ok', happened_at: '2026-02-04T08:15:00Z', taken_at: '2026-02-06T18:40:00Z', taken_by: 'Sample Staff A', note: 'Given with food', how_recorded: 'tapped' },
      { id: 'k2', check_type_id: 'ct-med', subject_id: 'sub-test-dog-1', item: 'Sample Drops', amount: '2', outcome: 'ok', happened_at: '2026-02-05T08:15:00Z', taken_at: '2026-02-05T08:20:00Z', taken_by: 'Sample Staff A', how_recorded: 'paper' },
      { id: 'k3', check_type_id: 'ct-med', subject_id: 'sub-test-dog-2', item: 'Sample Drops', amount: '2', outcome: 'ok', happened_at: '2026-02-05T08:15:00Z', taken_by: 'Sample Staff A', how_recorded: 'import' },
    ];
    const lines = R.build(R.fromChecks(logs, JOB_TYPES), { month: '2026-02', dog });
    const get = (id) => lines.find((l) => l.id === id);
    expect(R.cell(get('k1'), 'note')).toBe('Given with food');   // saved two days later: no late mark
    expect(R.cell(get('k2'), 'note')).toBe('Recorded from paper.');
    expect(R.cell(get('k3'), 'note')).toBe('Imported.');
    const csv = R.toCsv({ kennel: 'K', month: '2026-02', printed: '' }, lines);
    expect(csv).toContain('Recorded from paper.');
    expect(csv).not.toMatch(/late/i);
  });

  test('UK time: a job at 23:30 UTC in summer falls on the next day', () => {
    const [l] = R.build(R.fromChecks([{ id: 's', check_type_id: 'ct-med', subject_id: 'sub-test-dog-1', item: 'X', outcome: 'ok', happened_at: '2026-06-30T23:30:00Z' }], JOB_TYPES), { month: '2026-07', dog });
    expect(R.cell(l, 'date', true)).toBe('2026-07-01');
    expect(R.cell(l, 'time')).toBe('00:30');
  });
});

test.describe('CD Hub: Medicines register on Compliance', () => {
  test('pick a month, download the CSV and open the print page; nothing is written', async ({ page, guard, context }) => {
    setFile(guard.world, 'BLD-dispense.csv', DISPENSE);
    setFile(guard.world, 'BLD-microchip.csv', CHIPS);
    setFile(guard.world, 'BLD-check_type.csv', 'id,tenant_id,type_key,label,target,asks_item,item_label,asks_amount,amount_unit\nct-med,ten-test,medicine,Medicine given,dog,true,Medicine,true,dose\n');
    setFile(guard.world, 'BLD-check_log.csv', 'id,tenant_id,check_type_id,subject_id,item,amount,outcome,happened_at,taken_at,taken_by,note,note_for_id,corrects_id,time_given\njb-1,ten-test,ct-med,sub-test-dog-2,Sample Drops,2,ok,2026-02-12T09:30:00Z,2026-02-12T09:30:00Z,Sample Staff A,,,,\n');
    await context.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="compliance"]');
    const card = page.locator('#compMeds');
    await expect(card.locator('details')).toHaveAttribute('open', '');   // Compliance folds start open
    const month = card.locator('#medsMonth');
    const counts = { '2026-02': 4, '2026-03': 1 };
    await expect(month.locator('option')).toHaveText(offered('2026-02').map((k) => label(k, counts[k])));
    await month.selectOption('2026-02');

    const [dl] = await Promise.all([page.waitForEvent('download'), card.locator('#medsCsv').click()]);
    expect(dl.suggestedFilename()).toBe('medicines-register-2026-02.csv');
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    expect(csv).toContain('Medicines register,Sample Kennel (invented)');
    expect(csv).toContain('Month,February 2026');
    expect(csv).toContain('2026-02-03,,Test Dog One,900000000000001,Med C,,,1 tablet,Oral,routine,,Lisa Carson,with food');
    expect(csv).not.toContain('dog card');
    expect(csv).not.toContain('Recorded in');
    expect(csv).toContain('Dog not on the current list');
    expect(csv).toContain('2026-02-12,09:30,Test Dog Two,,Sample Drops,,,2 dose,,,,Sample Staff A,');
    await expect(card.locator('#medsMsg')).toHaveText('Downloaded 4 entries.');

    await page.waitForFunction(() => !!window.BLDMedsRegister);   // fetched when Compliance opens
    const [pop] = await Promise.all([context.waitForEvent('page'), card.locator('#medsPrint').click()]);
    await expect(pop).toHaveURL(/cdhub\/meds-print\.html$/);
    await expect.poll(() => pop.evaluate(() => window.__printed || 0)).toBe(1);   // the print dialog opens once
    await pop.waitForTimeout(800);
    expect(await pop.evaluate(() => window.__printed)).toBe(1);   // and not twice
    await expect(pop.locator('h1')).toHaveText('Medicines register · February 2026');
    await expect(pop.locator('tbody tr')).toHaveCount(4);
    await expect(pop.locator('.meta').first()).toContainText('Sample Kennel (invented)');
    await expect(pop.locator('.gaps')).not.toContainText('Batch');
    await expect(pop.locator('.gaps')).not.toContainText('Given by');
    await expect(pop.locator('tbody')).toContainText('Lisa Carson');
    await expect(pop.locator('table')).not.toContainText('Recorded in');
    await expect(card.locator('#medsMsg')).toHaveText('Opened 4 entries to print.');
    await pop.close();
  });

  test('a dose recorded from paper says so in the downloaded CSV @live', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-dispense.csv', DISPENSE);
    setFile(guard.world, 'BLD-microchip.csv', CHIPS);
    setFile(guard.world, 'BLD-check_type.csv', 'id,tenant_id,type_key,label,target,asks_item,item_label,asks_amount,amount_unit\nct-med,ten-test,medicine,Medicine given,dog,true,Medicine,true,dose\n');
    setFile(guard.world, 'BLD-check_log.csv', 'id,tenant_id,check_type_id,subject_id,item,amount,outcome,happened_at,taken_at,taken_by,note,note_for_id,corrects_id,time_given,how_recorded\njb-p,ten-test,ct-med,sub-test-dog-2,Sample Drops,2,ok,2026-02-12T09:30:00Z,2026-02-14T18:00:00Z,Sample Staff A,,,,,paper\n');
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="compliance"]');
    const card = page.locator('#compMeds');
    await card.locator('#medsMonth').selectOption('2026-02');
    const [dl] = await Promise.all([page.waitForEvent('download'), card.locator('#medsCsv').click()]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    expect(csv).toContain('Sample Drops');
    expect(csv).toContain('Recorded from paper.');
    expect(csv).not.toMatch(/late/i);
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
    await expect(pop.locator('body')).toContainText('No records this month.');
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
    await expect(pop.locator('body')).toContainText('No records this month.');
    await pop.close();
  });

  test('the print page opened on its own says where to go, and shows nothing', async ({ page }) => {
    await page.goto('cdhub/meds-print.html');
    await expect(page.locator('#medsPrintNone')).toContainText('Open this from CD Hub: Compliance, Medicines register, then Print.');
    await expect(page.locator('table')).toHaveCount(0);
  });

});

// the owner 23 Nov 2026: no internal codes on paper. A record id looks like clg-20261118-042020-vf20.
const ID_PATTERN = /\b[a-z]{2,5}-(?=[a-z0-9-]*\d)[a-z0-9]+(?:-[a-z0-9]+)*\b/i;
test('a parasite dose joins the medicines register once, and a vet procedure drug does not @regression', () => {
  const types = [
    { id: 'ct-med', type_key: 'medicine', label: 'Medicine given', amount_unit: 'dose' },
    { id: 'cty-parasites-1', type_key: 'parasites', label: 'Flea, worm and tapeworm treatment', amount_unit: '' }
  ];
  const logs = [
    { id: 'clg-par-1', check_type_id: 'cty-parasites-1', subject_id: 'sub-test-dog-1', item: 'Moxiclear', amount: '1 pipette', outcome: 'ok', happened_at: '2026-11-08T12:00:00Z', note: 'backfill Lisa 25 Nov', taken_by: 'Lisa Carson' },
    { id: 'clg-par-2', check_type_id: 'cty-parasites-1', subject_id: 'sub-test-dog-1', item: 'Moxiclear', amount: '1 pipette', outcome: 'ok', happened_at: '2026-11-08T12:00:00Z', note: 'same dose again' },
    { id: 'clg-op', check_type_id: 'ct-med', subject_id: 'sub-test-dog-1', item: 'Propofol', amount: '2 ml', outcome: 'ok', happened_at: '2026-11-09T12:00:00Z', note: 'vet procedure' }
  ];
  const dispense = [{ id: 'dsp-same', subject_id: 'sub-test-dog-1', given_on: '2026-11-20', product: 'Panacur', dose_volume: '4.5 ml', note: 'from clg-par-9' }];
  const lines = R.build(R.combine(dispense, logs.concat([{ id: 'clg-par-9', check_type_id: 'cty-parasites-1', subject_id: 'sub-test-dog-1', item: 'Panacur', amount: '4.5 ml', outcome: 'ok', happened_at: '2026-11-20T12:00:00Z' }]), types), { month: '2026-11', dog });
  expect(lines.map((l) => l.product)).toEqual(['Moxiclear', 'Panacur']);
  expect(lines.map((l) => l.id)).toEqual(['clg-par-1', 'dsp-same']);
  expect(R.cell(lines[0], 'note')).not.toMatch(/backfill/i);
  expect(R.toHtml({ kennel: 'Sample Kennel', month: '2026-11', printed: '25 Nov 2026' }, lines)).not.toMatch(/Propofol|backfill/i);
});

test('the medicines register does not show where it was recorded, and a blank name is Lisa Carson @regression', () => {
  const [blank, named] = R.build([
    { id: 'a', subject_id: 'sub-test-dog-1', given_on: '2026-02-03', product: 'Sample Wormer', dose_volume: '1 tablet' },
    { id: 'b', subject_id: 'sub-test-dog-1', given_on: '2026-02-04', product: 'Sample Wormer', dose_volume: '1 tablet', given_by: 'Sample Staff' }
  ], { month: '2026-02', dog });
  expect(R.cell(blank, 'given_by')).toBe('Lisa Carson');
  expect(R.cell(named, 'given_by')).toBe('Sample Staff');
  expect(R.COLUMNS.some((c) => c[0] === 'source')).toBe(false);
  const html = R.toHtml({ kennel: 'Sample Kennel', month: '2026-02', printed: '25 Nov 2026' }, [blank, named]);
  const csv = R.toCsv({ kennel: 'Sample Kennel', month: '2026-02', printed: '25 Nov 2026' }, [blank, named]);
  expect(html).not.toContain('Recorded in');
  expect(html).not.toContain('dog card');
  expect(html).toContain('Lisa Carson');
  expect(csv).not.toContain('dog card');
  expect(csv).toContain('Lisa Carson');
  expect(csv).toContain('Sample Staff');
});

test.describe('Medicines register: no internal codes, nothing counted twice', () => {
  const disp = [
    { id: 'dsp-a1', subject_id: 'sub-test-dog-1', given_on: '2026-02-04', product: 'Sample Drops', dose_volume: '2', note: 'from clg-20261118-042020-vf20' },
    { id: 'dsp-a2', subject_id: 'sub-gone-77', given_on: '2026-02-05', product: 'Med C', note: 'with food (from chk-9x2k1)' },
  ];
  const logs = [
    { id: 'clg-20261118-042020-vf20', check_type_id: 'ct-med', subject_id: 'sub-test-dog-1', item: 'Sample Drops', amount: '2', outcome: 'ok', happened_at: '2026-02-04T08:00:00Z', taken_by: 'Sample Staff A' },
    { id: 'clg-20261120-090000-ab12', check_type_id: 'ct-med', subject_id: 'sub-test-dog-2', item: 'Sample Tablet', outcome: 'ok', happened_at: '2026-02-06T08:00:00Z', taken_by: 'visit:lnk-4f9k2a', note: 'see rdg-20261120-01' },
  ];
  const types = [{ id: 'ct-med', type_key: 'medicine', amount_unit: 'dose' }];

  test('"from <id>" is dropped, real note text stays; a dose copied to the dog card is printed once', () => {
    const lines = R.build(R.combine(disp, logs, types), { month: '2026-02', dog });
    expect(lines.map((l) => l.id)).toEqual(['dsp-a1', 'dsp-a2', 'clg-20261120-090000-ab12']);   // the copied job row is not repeated
    expect(R.cell(lines[0], 'note')).toBe('');
    expect(R.cell(lines[0], 'source')).toBe('dog card');
    expect(R.cell(lines[1], 'note')).toBe('with food');
    expect(R.cell(lines[1], 'dog')).toBe('Dog not on the current list');
    expect(R.cell(lines[2], 'given_by')).toBe('Visitor (shared link)');
    expect(R.cell(lines[2], 'source')).toBe('staff job');
  });

  test('no id pattern anywhere in the CSV or the print page', () => {
    const lines = R.build(R.combine(disp, logs, types), { month: '2026-02', dog });
    const head = { kennel: 'Sample Kennel', month: '2026-02', printed: '23 Nov 2026 10:00' };
    expect(R.toCsv(head, lines)).not.toMatch(ID_PATTERN);
    expect(R.toHtml(head, lines).replace(/<[^>]+>/g, ' ')).not.toMatch(ID_PATTERN);
  });
});
