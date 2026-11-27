// Yearly print on Compliance: the shared A4 page, opened from the daily calendars and the checks register.
// Read only. Invented rows only.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { tabClick } = require('../support/tabs');
const { IDS } = require('../support/world');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const setFile = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-yp-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const TYPE = 'id,tenant_id,type_key,label,target,active,effective_from,every_days,site_scope\n'
  + 'ct-h,t,health_check_all,Health check,none,true,2026-01-01,1,per_dog\n'
  + 'ct-p,t,parasites,Parasites,dog,true,2026-01-01,90,\n'
  + 'ct-f,t,future_job,Future job,none,true,2026-01-01,1,\n';
const LOG = 'id,tenant_id,check_type_id,subject_id,outcome,happened_at,taken_by,note\n'
  + 'l1,t,ct-h,sub-test-dog-1,ok,2026-03-02T09:00:00Z,Sample Staff,\n'
  + 'l2,t,ct-p,sub-test-dog-1,ok,2026-02-11T09:00:00Z,Sample Staff,Spring dose\n';

test('Print / PDF on the daily calendars and the checks register opens Yearly print with those records ticked', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-check_type.csv', TYPE);
  setFile(guard.world, 'BLD-check_log.csv', LOG);
  await page.goto('cdhub/');
  await signIn(page);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  await tabClick(page, '#nav button[data-go="compliance"]');
  await expect(page.locator('#jobCals [data-yp="cal"]')).toHaveText('Print / PDF');
  await expect(page.locator('#ckrYear')).toHaveText('Print / PDF');
  await page.locator('#jobCals [data-yp="cal"]').click();
  await expect(page.locator('h2').first()).toHaveText('Yearly print');
  await expect(page.locator('input[name="ypType"][value="check:health_check_all"]')).toBeChecked();
  await expect(page.locator('input[name="ypType"][value="check:parasites"]')).not.toBeChecked();
  await expect(page.locator('input[name="ypType"][value="medicines"]')).toBeVisible();
  await expect(page.locator('input[name="ypType"][value="fit_to_breed"]')).toBeVisible();
  await expect(page.locator('input[name="ypType"][value="microchip"]')).toBeVisible();
});

test('one month of health checks prints a grid, a sparse type prints a list, and CSV downloads nothing written', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-check_type.csv', TYPE);
  setFile(guard.world, 'BLD-check_log.csv', LOG);
  await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await page.goto('cdhub/#/yearly');
  await signIn(page);
  await expect(page.locator('#ypMonth')).toBeVisible({ timeout: 20000 });
  await page.locator('#ypMonth').selectOption('2');
  await page.locator('#ypYear').selectOption('2026');
  await page.locator('input[name="ypType"][value="check:health_check_all"]').check();
  await page.locator('#ypPrint').click();
  await expect.poll(() => page.evaluate(() => window.__printed || 0)).toBe(1);
  const grid = page.locator('#ypReport [data-yp-page]');
  await expect(grid).toHaveAttribute('data-layout', 'dogs');
  await expect(grid).toHaveAttribute('data-month', '2026-03');
  await expect(grid).toContainText('Health check');
  await expect(grid.locator('[data-mark="tick"]')).toHaveCount(1);
  await page.evaluate(() => document.body.classList.remove('yp-printing'));

  await page.locator('input[name="ypType"][value="check:health_check_all"]').uncheck();
  await page.locator('input[name="ypType"][value="check:parasites"]').check();
  await page.locator('#ypMonth').selectOption('1');
  await page.locator('#ypPrint').click();
  await expect(page.locator('#ypReport [data-layout="list"]')).toContainText('Spring dose');
  await expect(page.locator('#ypReport [data-layout="list"]')).toContainText('February 2026');

  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#ypCsv').click()]);
  expect(dl.suggestedFilename()).toBe('yearly-parasites-2026-02.csv');
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  expect(csv).toContain('Parasites');
  expect(csv).toContain('2026-02-11');
  expect(csv).toContain('Spring dose');
});

test('screenshots: a health-check month, a sparse month, and a medicines month', async ({ page }) => {
  const dir = '/opt/cursor/artifacts';
  fs.mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: 1200, height: 860 });
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.addScriptTag({ path: require('path').join(__dirname, '..', '..', 'cdhub', 'yearly-print.js') });
  await page.addScriptTag({ path: require('path').join(__dirname, '..', '..', 'cdhub', 'meds-register.js') });
  const shots = await page.evaluate(async () => {
    const Y = window.BLDYearlyPrint, R = window.BLDMedsRegister;
    const today = '2026-03-15';
    const types = [
      { id: 'ct-h', type_key: 'health_check_all', label: 'Health check', target: 'none', site_scope: 'per_dog', every_days: '1', effective_from: '2026-01-01' },
      { id: 'ct-p', type_key: 'parasites', label: 'Parasites', target: 'dog', every_days: '90', effective_from: '2026-01-01' }
    ];
    const dogs = [{ id: 'd1', name: 'Ada', dob: '2024-01-01', onSite: true }, { id: 'd2', name: 'Bob', dob: '2024-06-01', onSite: true }];
    const logs = [
      { id: 'l1', check_type_id: 'ct-h', subject_id: 'd1', outcome: 'ok', happened_at: '2026-03-02T09:00:00Z', taken_by: 'Sample Staff' },
      { id: 'l2', check_type_id: 'ct-h', subject_id: 'd2', outcome: 'part_done', happened_at: '2026-03-02T09:00:00Z', taken_by: 'Sample Staff', note: 'half the check' },
      { id: 'l3', check_type_id: 'ct-p', subject_id: 'd1', outcome: 'ok', happened_at: '2026-02-11T09:00:00Z', taken_by: 'Sample Staff', note: 'Spring dose' }
    ];
    const ctx = { today: today, kennel: 'Sample Kennel', printed: '15 Mar 2026', types: types, logs: logs, dogs: dogs, tables: {}, dogName: (id) => (dogs.find((d) => d.id === id) || {}).name || '' };
    const health = Y.build({ period: 'month', year: 2026, month: 2, ids: ['check:health_check_all'], today: today }, ctx).html;
    const sparse = Y.build({ period: 'month', year: 2026, month: 1, ids: ['check:parasites'], today: today }, ctx).html;
    const lines = R.build([{ id: 'dsp', subject_id: 'd1', given_on: '2026-03-04', product: 'Med C', dose_volume: '1 tablet', given_by: 'Sample Staff' }], { month: '2026-03', dog: () => ({ name: 'Ada', chip: '' }) });
    const meds = R.toHtml({ kennel: 'Sample Kennel', month: '2026-03', printed: '15 Mar 2026' }, lines);
    const wrap = (inner) => '<!doctype html><html><head><meta charset="utf-8"><style>' + Y.CSS + 'body{margin:0;background:#fff}#ypReport{display:block}</style></head><body><div id="ypReport">' + inner + '</div></body></html>';
    return { health: wrap(health), sparse: wrap(sparse), meds: meds.replace(/<script[\s\S]*?<\/script>/gi, '') };
  });
  for (const [name, html, sel] of [['health-check-month', shots.health, '.yp-page'], ['parasites-month', shots.sparse, '.yp-page'], ['medicines-month', shots.meds, '.meds-sheet']]) {
    await page.setContent(html, { waitUntil: 'load' });
    await page.locator(sel).first().screenshot({ path: path.join(dir, name + '.png') });
  }
  expect(fs.existsSync(path.join(dir, 'health-check-month.png'))).toBe(true);
});

const YPrint = require('../../cdhub/yearly-print.js');
const MedsReg = require('../../cdhub/meds-register.js');

test('exercise rows on another type and round rows still fill the year grid @regression', () => {
  const today = '2026-11-25';
  const types = [
    { id: 'cty-play-9', type_key: 'exercise_and_play', label: 'Exercise and play', target: 'none', site_scope: 'per_dog', every_days: '1', effective_from: '2026-11-01' },
    { id: 'cty-exercise_all-1', type_key: 'exercise_all', label: 'Exercise all', target: 'none', site_scope: 'per_dog', every_days: '1', effective_from: '2026-01-01' }
  ];
  const dogs = [{ id: 'ada', name: 'Ada', dob: '2020-01-01', onSite: true, kind: 'Breeding Female' }];
  const logs = [];
  for (let d = 1; d <= 31; d++) logs.push({ id: 'p' + d, check_type_id: 'cty-exercise_all-1', subject_id: 'ada', outcome: 'ok', happened_at: '2026-10-' + String(d).padStart(2, '0') + 'T12:00:00Z' });
  logs.push({ id: 'round', check_type_id: 'cty-exercise_all-1', covered_ids: 'ada', outcome: 'recorded', happened_at: '2026-09-15T12:00:00Z' });
  const ctx = { today, kennel: 'Pretend Kennel', types, logs, dogs, tables: {}, dogName: (id) => (dogs.find((d) => d.id === id) || {}).name || '' };
  const src = YPrint.catalogue(ctx).find((s) => s.id === 'check:exercise_all');
  expect(src.typeIds.sort()).toEqual(['cty-exercise_all-1', 'cty-play-9']);
  const oct = YPrint.gridMonth(src, '2026-10', ctx);
  expect(oct.marks.ada['2026-10-01']).toBe('tick');
  expect(oct.marks.ada['2026-10-31']).toBe('tick');
  const sep = YPrint.gridMonth(src, '2026-09', ctx);
  expect(sep.marks.ada['2026-09-15']).toBe('tick');
});

test('a litter puppy is left off the exercise grid @regression', () => {
  const today = '2026-11-25';
  const types = [{ id: 'cty-exercise_all-1', type_key: 'exercise_all', label: 'Exercise and play', target: 'none', site_scope: 'per_dog', every_days: '1', effective_from: '2026-01-01' }];
  const dogs = [
    { id: 'ada', name: 'Ada', dob: '2020-01-01', onSite: true, kind: 'Breeding Female' },
    { id: 'pup', name: 'Marble x Sammy 2026 - Black male 1', dob: '2026-06-01', kind: 'Pup', birth_litter_id: 'lit-1', onSite: true }
  ];
  const ctx = { today, kennel: 'Pretend Kennel', types, logs: [{ id: 'lp', check_type_id: 'cty-exercise_all-1', subject_id: 'pup', outcome: 'ok', happened_at: '2026-11-02T12:00:00Z' }], dogs, tables: {}, dogName: (id) => (dogs.find((d) => d.id === id) || {}).name || '' };
  const nov = YPrint.gridMonth(YPrint.catalogue(ctx).find((s) => s.typeKey === 'exercise_all'), '2026-11', ctx);
  expect(nov.rows.map((r) => r.name)).toEqual(['Ada']);
  expect(nov.rows.find((r) => r.id === 'pup')).toBeFalsy();
});

test('the yearly print header uses the kennel name and never says Kennel not recorded @regression', () => {
  const ctx = {
    today: '2026-11-25', kennel: '', types: [], logs: [], dogs: [], areas: [],
    tables: {
      'BLD-tenant.csv': [{ id: 'ten', name: '', licence_number: 'LIC-12345' }],
      'BLD-breeding_rule.csv': [{ rule_key: 'kennel.name', value: 'Pretend Kennel', effective_from: '2020-01-01' }]
    }
  };
  const html = YPrint.build({ period: 'month', year: 2026, month: 10, ids: ['area_reading'], today: '2026-11-25' }, ctx).html;
  expect(html).toContain('Pretend Kennel');
  expect(html).not.toContain('Kennel not recorded');
  expect(html).not.toContain('LIC-12345');
  const blank = YPrint.build({ period: 'month', year: 2026, month: 10, ids: ['area_reading'], today: '2026-11-25' }, { today: '2026-11-25', kennel: '', types: [], logs: [], areas: [], tables: { 'BLD-tenant.csv': [{ licence_number: 'LIC-12345' }] } }).html;
  expect(blank).not.toContain('Kennel not recorded');
  expect(blank).not.toContain('LIC-12345');
});

test('room temperatures print as one daily min and max sheet a month @regression', () => {
  const rows = [];
  for (let d = 1; d <= 20; d++) {
    const day = '2026-10-' + String(d).padStart(2, '0');
    rows.push({ id: 'a' + d, area_id: 'a1', min_c: '10', max_c: '18', period_start: day + 'T08:00:00Z' });
    rows.push({ id: 'b' + d, area_id: 'a1', min_c: '12', max_c: '20', period_start: day + 'T18:00:00Z' });
  }
  const ctx = { today: '2026-11-25', kennel: 'Pretend Kennel', types: [], logs: [], areas: [{ id: 'a1', name: 'Cabin A', onSite: true }], tables: { 'BLD-area_reading.csv': rows }, areaName: () => 'Cabin A' };
  const built = YPrint.build({ period: 'month', year: 2026, month: 9, ids: ['area_reading'], today: '2026-11-25' }, ctx);
  expect(built.pages).toHaveLength(1);
  expect(built.pages[0].layout).toBe('temps');
  expect(built.html).toContain('data-temp-grid');
  expect(built.html).toContain('10.0–20.0');
  expect(built.html.match(/<tr>/g).length).toBeLessThan(5);
});

test('an empty medicines month says no records and optional fields stay blank @regression', () => {
  const [line] = MedsReg.build([{ id: 'd', subject_id: 'a', given_on: '2026-02-03', product: 'Wormer', dose_volume: '1 tablet' }], { month: '2026-02', dog: () => ({ name: 'Ada', chip: '' }) });
  expect(MedsReg.cell(line, 'dose')).toBe('1 tablet');
  expect(MedsReg.cell(line, 'given_by')).toBe(MedsReg.NR);   // no Settings default given
  expect(MedsReg.cell(line, 'time')).toBe('');
  expect(MedsReg.cell(line, 'batch')).toBe('');
  expect(MedsReg.cell(line, 'expiry')).toBe('');
  const html = MedsReg.toHtml({ kennel: '', month: '2026-03', printed: '1 Mar 2026' }, []);
  expect(html).toContain('No records this month.');
  expect(html).not.toContain('Kennel not recorded');
  expect(html).not.toContain('not recorded</span>');
});

test('select all and select all with entries follow the period counts', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-check_type.csv', 'id,tenant_id,type_key,label,target,active,effective_from,every_days,site_scope,group\n'
    + 't-a,t,type_a,Type A,none,true,2026-01-01,1,per_dog,Group A\n'
    + 't-b,t,type_b,Type B,dog,true,2026-01-01,90,,Group B\n');
  setFile(guard.world, 'BLD-check_log.csv', 'id,tenant_id,check_type_id,subject_id,outcome,happened_at,taken_by,note\n'
    + 'r1,t,t-a,s1,ok,2026-03-02T09:00:00Z,,\n'
    + 'r2,t,t-b,s1,ok,2026-02-11T09:00:00Z,,\n');
  setFile(guard.world, 'BLD-dispense.csv', 'id,subject_id,given_on,product,dose_volume\n'
    + 'm1,s1,2026-03-04,Item A,1\n'
    + 'm2,s1,2026-01-02,Item B,1\n');
  setFile(guard.world, 'BLD-weight.csv', 'id,subject_id,performed_on,weight_kg,unit\nw1,s1,2026-02-05,2,kg\n');
  await page.goto('cdhub/#/yearly/cal');
  await signIn(page);
  await expect(page.locator('#ypEntries')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#ypPrint, #ypCsv, #ypAll, #ypNone, #ypEntries')).toHaveText([
    'Print / PDF', 'Download CSV', 'Select all', 'None', 'Select all with entries'
  ]);
  await expect(page.locator('#ypAll')).toHaveClass(/btn/);
  await expect(page.locator('#ypEntries')).toHaveClass(/btn/);
  await expect(page.locator('h3', { hasText: 'Group A' })).toBeVisible();
  await page.locator('#ypYear').selectOption('2026');
  await page.locator('#ypMonth').selectOption('2');
  const box = (id) => page.locator('input[name="ypType"][value="' + id + '"]');
  const n = (id) => page.locator('[data-yp-n="' + id + '"]');
  await expect(n('check:type_a')).toHaveText('1');
  await expect(n('check:type_b')).toHaveText('0');
  await expect(n('medicines')).toHaveText('1');
  await expect(n('weight')).toHaveText('0');
  await page.locator('#ypEntries').click();
  await expect(box('check:type_a')).toBeChecked();
  await expect(box('check:type_b')).not.toBeChecked();
  await expect(box('medicines')).toBeChecked();
  await expect(box('weight')).not.toBeChecked();
  await expect(page.locator('#ypMsg')).toContainText('with entries ticked');
  await page.locator('#ypNone').click();
  await expect(page.locator('input[name="ypType"]:checked')).toHaveCount(0);
  await expect(page.locator('#ypMsg')).toHaveText('Nothing ticked.');
  await page.locator('#ypAll').click();
  const total = await page.locator('input[name="ypType"]').count();
  await expect(page.locator('input[name="ypType"]:checked')).toHaveCount(total);
  await expect(page.locator('#ypMsg')).toHaveText('Every type ticked.');
  expect(total).toBeGreaterThan(2);
  await page.locator('#ypNone').click();
  await page.locator('#ypMonth').selectOption('1');
  await expect(n('check:type_a')).toHaveText('0');
  await expect(n('check:type_b')).toHaveText('1');
  await expect(n('weight')).toHaveText('1');
  await expect(n('medicines')).toHaveText('0');
  await expect(box('check:type_a')).not.toBeChecked();
  await page.locator('#ypEntries').click();
  await expect(box('check:type_b')).toBeChecked();
  await expect(box('check:type_a')).not.toBeChecked();
  await expect(box('weight')).toBeChecked();
  await expect(box('medicines')).not.toBeChecked();
  await page.locator('#ypPeriod').selectOption('year');
  await expect(page.locator('#ypMonth')).toBeDisabled();
  await expect(n('check:type_a')).toHaveText('1');
  await expect(n('check:type_b')).toHaveText('1');
  await expect(n('medicines')).toHaveText('2');
  await expect(n('weight')).toHaveText('1');
  await page.locator('#ypEntries').click();
  await expect(box('check:type_a')).toBeChecked();
  await expect(box('check:type_b')).toBeChecked();
  await expect(box('medicines')).toBeChecked();
  await expect(box('weight')).toBeChecked();
});

function pdfPageText(buf) {
  const zlib = require('zlib');
  const raw = Buffer.from(buf).toString('latin1');
  const out = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(raw))) {
    let txt;
    try { txt = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch (e) { continue; }
    if (!/Tj/.test(txt)) continue;
    let s = '', h;
    const hex = /<([0-9A-Fa-f]+)>/g;
    while ((h = hex.exec(txt))) {
      for (let i = 0; i < h[1].length; i += 4) s += String.fromCharCode(parseInt(h[1].slice(i, i + 4), 16) + 0x1d);
    }
    if (s.trim()) out.push(s);
  }
  return out;
}

test('types flow onto the next page only when the page is full @regression', async ({ page }) => {
  const css = YPrint.CSS;
  const clash = '@media print{body{padding:10mm!important;box-decoration-break:clone}}';
  const block = (title, line) => '<section class="yp-page"><div class="yp-stick"><div class="yp-head">' + title + '</div><p>' + line + '</p></div></section>';
  const wrap = (inner) => '<!doctype html><html><head><style>' + clash + css + '</style></head><body class="yp-printing"><div id="ypReport">' + inner + '</div></body></html>';
  await page.setContent(wrap(block('Block A', 'Line A') + block('Block B', 'Line B')));
  const shortPdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  const shortPages = pdfPageText(shortPdf);
  expect(shortPages.length).toBe(1);
  expect(shortPages[0]).toContain('Page 1 of 1');
  expect(shortPages[0]).toContain('Block A');
  expect(shortPages[0]).toContain('Block B');

  await page.setContent(wrap('<section class="yp-page"><div style="height:400mm">Tall block</div></section>'));
  const tallPages = pdfPageText(await page.pdf({ printBackground: true, preferCSSPageSize: true }));
  expect(tallPages.length).toBeGreaterThan(1);

  const rows = Array.from({ length: 6 }, (_, i) => '<tr><td>Row ' + (i + 1) + '</td><td>Value</td></tr>').join('');
  await page.setContent(wrap('<div style="height:186mm">Filler</div><section class="yp-page"><div class="yp-stick"><div class="yp-head">Heading A</div><p>First line</p></div><table class="yp-t"><tr><th>H</th><th>V</th></tr>' + rows + '</table></section>'));
  const flow = pdfPageText(await page.pdf({ printBackground: true, preferCSSPageSize: true }));
  const headPage = flow.findIndex((t) => t.includes('Heading A'));
  expect(headPage).toBeGreaterThan(0);
  expect(flow[headPage]).toContain('First line');
  expect(flow[headPage]).toContain('Row 1');
  expect(flow[0]).not.toContain('Heading A');
});

test('a month with exercise records paints marks in the yearly grid @regression', () => {
  const today = '2026-11-25';
  const types = [
    { id: 'cty-exercise-1', type_key: 'exercise', label: 'Exercise and play', target: 'area', site_scope: 'per_dog', every_days: '1', effective_from: '2026-11-09' },
    { id: 'cty-exercise_all-1', type_key: 'exercise_all', label: 'Exercise and play: all dogs', target: 'none', site_scope: 'per_dog', every_days: '1', effective_from: '2026-11-17', includes: 'exercise' }
  ];
  const dogs = [
    { id: 'ada', name: 'Ada', dob: '2020-01-01', onSite: true, kind: 'Breeding Female' },
    { id: 'pup', name: 'Marble x Sammy 2026 - Black male 1', dob: '2026-06-01', onSite: true, kind: 'Pup' }
  ];
  const logs = [
    { id: 'e1', check_type_id: 'cty-exercise_all-1', subject_id: 'ada', outcome: 'ok', happened_at: '2026-10-01T12:00:00Z' },
    { id: 'e2', check_type_id: 'cty-exercise_all-1', covered_ids: 'ada', outcome: 'recorded', happened_at: '2026-10-02T12:00:00Z' }
  ];
  const ctx = { today, kennel: 'Pretend Kennel', types, logs, dogs, tables: {}, dogName: (id) => (dogs.find((d) => d.id === id) || {}).name || '' };
  const src = YPrint.catalogue(ctx).find((s) => s.id === 'check:exercise_all');
  const oct = YPrint.gridMonth(src, '2026-10', ctx);
  expect(oct.rows.map((r) => r.name)).toEqual(['Ada']);
  expect(oct.marks.ada['2026-10-01']).toBe('tick');
  expect(oct.marks.ada['2026-10-02']).toBe('tick');
  expect(oct.marks.ada['2026-10-03']).toBe('miss');
  const jan = YPrint.build({ period: 'month', year: 2026, month: 0, ids: ['check:exercise_all'], today }, ctx);
  expect(jan.html).not.toContain('data-mark="tick"');
  expect(jan.html).toContain('Not tracked yet this month.');
  expect(jan.html).toContain('Pretend Kennel');
  expect(jan.html).not.toContain('Kennel not recorded');
  expect(jan.html).not.toContain('Marble x Sammy');
  const year = YPrint.build({ period: 'year', year: 2026, ids: ['check:exercise_all'], today }, ctx);
  expect(year.pages).toHaveLength(11);
  expect(year.pages.every((p) => p.layout === 'dogs')).toBe(true);
  const octPage = year.pages.find((p) => p.month === '2026-10');
  expect(octPage.html).toContain('data-mark="tick"');
});

test('the yearly print page loads with no console errors @regression', async ({ page, guard }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err && err.message || err)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('cdhub/');
  await signIn(page);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  errors.length = 0;
  await page.evaluate(() => { location.hash = '#/yearly'; });
  await expect(page.locator('h2').first()).toHaveText('Yearly print');
  await expect(page.locator('#ypPrint')).toBeVisible();
  expect(errors).toEqual([]);
});
