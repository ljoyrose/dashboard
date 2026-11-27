// Temperatures month report (the owner 20 Nov 2026): one month, all rooms or one, saved as a PDF from the browser's print.
// Each slot is judged by the rows in force that day; the youngest dog that day (occupancy + date of birth) picks the
// row, so a room with puppies under four weeks on a PAST day is judged on the bed spot against the puppy row.
// Past years load. Pretend Drive only; every row here is invented.
const { test, expect } = require('../support/test');

const LOADED = { timeout: 20000 };
const NOW = new Date('2026-01-12T20:00:00');
const ROOMS = 'id,code,group_sort\narea-r1,R1,1\narea-r2,R2,2\n';
const NEEDS = 'id,tenant_id,need_type,target_table,target_id,from_date,to_date,source,set_by,set_on\n';
const BANDS = 'id,band,age_from_days,age_to_days,min_temp,max_temp,from_date,to_date\ntb-p,Puppy,0,28,26,28,,\ntb-a,Adult,29,,10,26,,\n';
// A litter born 1 Nov 2025 in R1; R2 holds no dogs. So in Nov 2025 R1 is a puppy room (bed spot on 26–28) and R2 is adult.
const SUBJ = 'id,tenant_id,name,sex,dob\npup-1,t,Pup,F,2025-11-01\n';
const OCC = 'id,tenant_id,subject_id,area_id,off_site_kind,moved_in,moved_out\nocc-1,t,pup-1,area-r1,,2025-11-01,\n';
const R = [];
const add = (aid, day, slot, min, max, spot, note) => R.push([aid, day, slot, min, max, spot || '', note || '']);
add('area-r1', '2025-11-03', 'am', '18.0', '22.0', '27.0');                  // puppy room, bed spot inside 26–28
add('area-r1', '2025-11-03', 'pm', '18.0', '22.0', '24.5', 'Heat lamp on');  // bed spot below 26: outside, with what was done
add('area-r2', '2025-11-03', 'am', '12.0', '15.0');                          // adult room inside 10–26
add('area-r2', '2025-11-03', 'pm', '9.0', '15.0', '', 'Heater on');          // below 10: outside
add('area-r2', '2025-11-04', 'am', '14.0', '27.0', '', 'Fan on');            // over 26: cooling action, not outside
add('area-r1', '2026-01-05', 'am', '12.0', '15.0');                          // this year, so the page has a current month too
const READINGS = 'id,area_id,taken_at,period_start,min_c,max_c,spot_c,read_method,mitigation_note\n'
  + R.map((r, i) => ['rdg-' + i, r[0], r[1] + 'T' + (r[2] === 'am' ? '09' : '16') + ':00:00Z', r[1] + 'T' + (r[2] === 'am' ? '00' : '12') + ':00:00+00:00', r[3], r[4], r[5], 'typed', '"' + r[6] + '"'].join(',')).join('\n') + '\n';
const OUTDOOR = 'on_date,reading_kind,max_temp,min_temp,realfeel_max_temp,rain_value,cloud_cover_pct,wind_kmh\n2026-01-05,sample,5.3,-1.9,2.3,0,8,13.7\n';

async function open(page, guard, hash) {
  const a0 = guard.world.files.find((x) => x.name === 'BLD-area.csv');
  const upsert = (id, name, content) => {
    const f = guard.world.files.find((x) => x.name === name);
    if (f) { f.content = content; f.size = String(content.length); }
    else guard.world.file(id, name, content, { parents: a0.parents.slice(), driveId: a0.driveId, mimeType: 'text/csv' });
  };
  upsert('bld-area', 'BLD-area.csv', ROOMS);
  upsert('bld-readings', 'BLD-area_reading.csv', READINGS);
  upsert('bld-req', 'BLD-requirement.csv', NEEDS);
  upsert('bld-band', 'BLD-temperature_band.csv', BANDS);
  upsert('bld-subj', 'BLD-subject.csv', SUBJ);
  upsert('bld-occ', 'BLD-occupancy.csv', OCC);
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => localStorage.setItem('ljr-dash-auth', JSON.stringify({ access_token: 'FAKE-TEST-TOKEN', expires_at: Date.now() + 1800000, scope: 'https://www.googleapis.com/auth/drive.readonly' })));
  await page.route(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export\?/, (route) => route.fulfill({ status: 200, contentType: 'text/csv', body: OUTDOOR }));
  await page.goto('cdhub/history.html' + (hash || ''));
  await expect(page.locator('#livepill')).toHaveText('Up to date', LOADED);
}
const dayRow = (room, words) => room.locator('tbody tr').filter({ has: room.page().locator('td:first-child', { hasText: new RegExp('^' + words + '$') }) });
async function pickMonth(page, value) {
  await page.getByRole('button', { name: 'Report' }).click();
  await page.locator('#repMonth').selectOption(value);
}

test('report: a past month (Nov 2025), all rooms, applies the puppy bed rule from that day\'s occupancy and lists what was done', async ({ page, guard }) => {
  await open(page, guard);
  await pickMonth(page, '2025-10');   // value is year-monthIndex: 10 = November
  const out = page.locator('#repOut');
  await expect(out.locator('.rep-h')).toHaveText('Room temperatures · Nov 2025 · All rooms');
  await expect(out.locator('.rep-room')).toHaveCount(2);
  const r1 = out.locator('.rep-room[data-unit="area-r1"]');
  const r1row = dayRow(r1, '3 Nov');
  await expect(r1row.locator('td').nth(4)).toHaveText('Room 10–26 · puppy bed 26–28');   // puppies 2 days old that day
  await expect(r1row.locator('td').nth(3)).toHaveText('27.0 / 24.5');
  await expect(r1row.locator('td').nth(5)).toHaveText('AM In limit · PM Bed spot below the puppy limit');
  await expect(r1row.locator('td').nth(6)).toHaveText('Heat lamp on');
  await expect(r1row).toHaveClass(/warn/);
  const r2 = out.locator('.rep-room[data-unit="area-r2"]');
  const r2a = dayRow(r2, '3 Nov');
  await expect(r2a.locator('td').nth(4)).toHaveText('10–26');                            // no dogs: the adult row
  await expect(r2a.locator('td').nth(5)).toHaveText('AM In limit · PM Below the limit');
  await expect(r2a.locator('td').nth(6)).toHaveText('Heater on');
  const r2b = dayRow(r2, '4 Nov');
  await expect(r2b.locator('td').nth(5)).toHaveText('Over max: cooling action');
  await expect(r2b).not.toHaveClass(/warn/);                                             // a cooling action is not outside; a PM with no reading is blank
  await expect(out).not.toContainText('Missed');                                         // owner ruling 27 Nov: never marked missed
  await expect(r2.locator('.rep-sum')).toHaveText('3 readings · lowest 9.0 °C · highest 27.0 °C · 1 outside the limit · 1 cooling actions');
  await expect(out.locator('.rep-all')).toHaveText('2 rooms · 5 readings · 2 outside the limit · 1 cooling actions');
  // one room only
  await page.locator('#repUnit').selectOption('area-r2');
  await expect(out.locator('.rep-room')).toHaveCount(1);
  await expect(out.locator('.rep-h')).toHaveText('Room temperatures · Nov 2025 · R2');
});

test('report: Save as PDF prints only the report, named for the month; the page itself prints to an A4 PDF', async ({ page, guard }) => {
  await open(page, guard);
  await pickMonth(page, '2025-10');
  await page.evaluate(() => { window.__printed = []; window.print = () => window.__printed.push({ title: document.title, cls: document.body.className }); });
  await page.getByRole('button', { name: 'Save as PDF' }).click();
  const printed = await page.evaluate(() => window.__printed);
  expect(printed).toEqual([{ title: 'Room temperatures Nov 2025 all rooms', cls: expect.stringContaining('print-report') }]);
  await expect(page.locator('#repSay')).toHaveText('The print window is open: choose Save as PDF as the printer.');
  // In print, only the report shows: no header, tabs, year buttons, month picker or bottom tabs.
  await page.evaluate(() => document.body.classList.add('print-report'));
  await page.emulateMedia({ media: 'print' });
  for (const sel of ['header.house-head', '#nav', '.yr-row', '.tab-row', '.rep-ctl']) await expect(page.locator(sel).first(), sel).toBeHidden();
  await expect(page.locator('#repOut')).toBeVisible();
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  if (process.env.REPORT_PDF) require('fs').writeFileSync(process.env.REPORT_PDF, pdf);
  expect(pdf.slice(0, 4).toString()).toBe('%PDF');
  expect(pdf.length).toBeGreaterThan(5000);
});

test('report: #report opens it; the year buttons reach back to the first reading and move The round into that year', async ({ page, guard }) => {
  await open(page, guard, '#report');
  await expect(page.locator('#view-r')).toHaveClass(/\bon\b/);
  await expect(page.locator('.yr-btn')).toHaveText(['2026', '2025', '2024']);   // this year and the two before (further back when readings go further)
  await page.getByRole('button', { name: 'The round' }).click();
  await expect(page.locator('#rdate')).toHaveValue('2026-01-12');
  await page.locator('.yr-btn[data-yr="2025"]').click();
  await expect(page.locator('#rdate')).toHaveValue('2025-01-12');         // was: 2025 pressed, The round still showed today
  await page.getByRole('button', { name: 'Report' }).click();
  await expect(page.locator('#repMonth')).toHaveValue('2025-0');           // and the report moved to Jan 2025
});

test('CD Hub: #m/temperature opens the month report instead of Main', async ({ page, guard }) => {
  await open(page, guard);
  await page.goto('cdhub/index.html#m/temperature');
  await expect(page).toHaveURL(/\/cdhub\/history\.html#report$/);
  await expect(page.locator('#livepill')).toHaveText('Up to date', LOADED);
  await expect(page.locator('#view-r')).toHaveClass(/\bon\b/);
});

test('report on a phone (375px): no sideways scroll, controls at least 40px', async ({ page, guard }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, guard);
  await pickMonth(page, '2025-10');
  const over = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(0);
  for (const sel of ['#repMonth', '#repUnit', '#repPdf']) {
    const b = await page.locator(sel).boundingBox();
    expect(b.height, sel).toBeGreaterThanOrEqual(40);
  }
});
