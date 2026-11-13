// Temperatures (History) page: layout, information, colour and audit rules (Lisa, 11 Nov 2026:
// "the info i need without looking alarming"). Pretend Drive only; every row here is invented.
// RULES is the one list later screens reuse (round, year report, prints).
const { test, expect } = require('../support/test');
// The page builds a whole year of views before it says "Up to date"; under a full parallel run that can pass 7 s (quality review 12 Nov).
const LOADED = { timeout: 20000 };
const fs = require('fs');
const path = require('path');

const RULES = {
  layout: {
    widths: [{ name: 'phone', width: 375, height: 812 }, { name: 'desktop', width: 1280, height: 800 }],
    noSideScroll: true,          // the page never scrolls sideways
    panelFits: true,             // the day panel fits inside the screen
    minTap: 40,                  // buttons, links, inputs, tabs and calendar days are at least 40px
    tapExempt: ['.sd', '.d.empty', '.d.future', '.d.nd', '.dh', '.skip'],   // year strip is an overview; blanks are not targets
    desktopExempt: ['.house-ib', '.house-fold'],   // house header buttons: 36px for a mouse, 44px on a phone (house.css)
  },
  words: {
    never: [/\bOK\b/, /In range/i, /Out of range/i, /Submitted/i, /camera/i, /typed/i, /photo/i, /corrected/i,
      /taken by/i, /entered by/i, /Feels like/i, /Max °C/, /Min °C/, /\bactual\b/i, /source/i],
    roomLine: /^[^·]+ · (AM (\d+\.\d–\d+\.\d( ✓)?|missed|due))?( · )?(PM (\d+\.\d–\d+\.\d( ✓)?|missed|due))?/,
    outsideLine: /^-?\d+(\.\d)? \/ -?\d+(\.\d)? °C(, rain \d+(\.\d)? mm)?$/,
    dayTitle: /^\d\d\/\d\d\/\d\d$/,   // DD/MM/YY
  },
  colour: {
    // Every colour on the page must be one of these house tokens (or transparent).
    allowed: ['--paper', '--card', '--soft', '--line', '--ink', '--muted', '--frame', '--frame-ink', '--frame-line', '--press',
      '--ljr-5', '--ljr-5-tint', '--ljr-5-text', '--ljr-6', '--ljr-6-tint', '--ljr-4-tint', '--ljr-3', '--ljr-3-text'],
    never: ['--ljr-2', '--ljr-2-text', '--ljr-2-icon', '--ljr-2-solid'],   // red: never
    warnOnly: ['--ljr-3', '--ljr-3-text'],   // orange: .warn (outside limit), .miss (outline), and those legend swatches
    outsideCalendarNever: ['--ljr-3', '--ljr-3-text', '--ljr-2', '--ljr-2-text'],
  },
  audit: {
    dayStates: { allok: 'In limit', warn: 'Check', miss: 'Missed', nd: 'No readings', nolimit: 'No limit set' },
  },
};

// Fixture month: Jan 2026. Today is 12/01/26 at 20:00 (PM today is still due).
// R1-R3 in use from 05/01; R4 retired: its room.in_use row ends 10/01 (BLD-requirement), so never missed after that.
const NOW = new Date('2026-01-12T20:00:00');
const ROOMS = 'id,code,group_sort\narea-r1,R1,1\narea-r2,R2,2\narea-r3,R3,3\narea-r4,R4,4\n';
const NEEDS = 'id,tenant_id,need_type,target_table,target_id,from_date,to_date,source,set_by,set_on\nreq-1,t,room.in_use,area,area-r4,2025-01-01,2026-01-10,,,\n';
const R = [];
const add = (aid, day, slot, min, max, note) => R.push([aid, day, slot, min, max, note || '']);
for (const aid of ['area-r1', 'area-r2', 'area-r3', 'area-r4']) { add(aid, '2026-01-05', 'am', '12.0', '15.0'); add(aid, '2026-01-05', 'pm', '12.5', '16.0'); }
for (const aid of ['area-r1', 'area-r3', 'area-r4']) { add(aid, '2026-01-06', 'am', '12.0', '15.0'); }
add('area-r2', '2026-01-06', 'am', '14.0', '27.0', 'Fan on, door open');            // outside the limit, with a note
for (const aid of ['area-r1', 'area-r2', 'area-r3', 'area-r4']) add(aid, '2026-01-06', 'pm', '12.0', '15.0');
for (const aid of ['area-r1', 'area-r2', 'area-r3', 'area-r4']) add(aid, '2026-01-07', 'am', '12.0', '15.0');
for (const aid of ['area-r1', 'area-r2', 'area-r4']) add(aid, '2026-01-07', 'pm', '12.0', '15.0');   // R3 PM missed
for (const aid of ['area-r2', 'area-r3', 'area-r4']) { add(aid, '2026-01-10', 'am', '12.0', '15.0'); add(aid, '2026-01-10', 'pm', '12.0', '15.0'); }
add('area-r1', '2026-01-10', 'am', '11.0', '15.0'); add('area-r1', '2026-01-10', 'pm', '9.0', '14.0');   // outside, no note
for (const aid of ['area-r1', 'area-r2', 'area-r3']) add(aid, '2026-01-12', 'am', '12.0', '15.0');
const READINGS = 'id,area_id,taken_at,period_start,min_c,max_c,read_method,camera_value_changed,taken_by,mitigation_note\n'
  + R.map((r, i) => ['rdg-' + i, r[0], r[1] + 'T' + (r[2] === 'am' ? '09' : '16') + ':00:00Z', r[1] + 'T' + (r[2] === 'am' ? '00' : '12') + ':00:00+00:00', r[3], r[4], 'camera', 'true', 'stf-1', '"' + r[5] + '"'].join(',')).join('\n') + '\n';
const OUTDOOR = 'on_date,reading_kind,max_temp,min_temp,realfeel_max_temp,rain_value,cloud_cover_pct,wind_kmh\n'
  + '2026-01-05,sample,5.3,-1.9,2.3,0,8,13.7\n2026-01-06,sample,11.0,4.0,9.0,2.5,80,20\n2026-01-07,sample,28.0,15.0,29.0,0,5,10\n';

// What the rules say Jan should total (worked out here, not by the page).
function expected() {
  const needed = { 'area-r1': ['2026-01-05', '2026-01-12'], 'area-r2': ['2026-01-05', '2026-01-12'], 'area-r3': ['2026-01-05', '2026-01-12'], 'area-r4': ['2026-01-05', '2026-01-10'] };
  let slots = 0;
  for (const [, [a, b]] of Object.entries(needed)) for (let d = 5; d <= +b.slice(8); d++) slots += (d === 12 && b === '2026-01-12') ? 1 : 2;   // today PM is due
  const read = R.length, out = R.filter((r) => +r[3] < 10 || +r[4] > 26).length;
  return { read, out, miss: slots - read };
}

async function open(page, guard, size, rooms, now) {
  const put = (name, content) => { const f = guard.world.files.find((x) => x.name === name); f.content = content; f.size = String(content.length); };
  put('BLD-area.csv', rooms || ROOMS);
  put('BLD-area_reading.csv', READINGS);
  const a0 = guard.world.files.find((x) => x.name === 'BLD-area.csv');
  guard.world.file('bld-req', 'BLD-requirement.csv', NEEDS, { parents: a0.parents.slice(), driveId: a0.driveId, mimeType: 'text/csv' });
  await page.clock.setFixedTime(now || NOW);
  if (size) await page.setViewportSize({ width: size.width, height: size.height });
  await page.addInitScript(() => localStorage.setItem('ljr-dash-auth', JSON.stringify({ access_token: 'FAKE-TEST-TOKEN', expires_at: Date.now() + 1800000, scope: 'https://www.googleapis.com/auth/drive.readonly' })));
  await page.route(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export\?/, (route) => route.fulfill({ status: 200, contentType: 'text/csv', body: OUTDOOR }));
  await page.goto('cdhub/history.html');
  await expect(page.locator('#livepill')).toHaveText('Up to date', LOADED);
  await page.locator('.yr-btn[data-yr="2026"]').click();
}
const day = (page, iso) => page.locator(`#view-a [data-cal="indoors"] button.d[title^="${+iso.slice(8)} Jan 2026 indoors"]`);
async function openDay(page, iso) {
  await page.getByRole('button', { name: 'Heat map' }).click();
  await day(page, iso).click();
  await expect(page.locator('#drill')).toBeVisible();
}

// ------------------------------------------------------------------ LAYOUT
for (const size of RULES.layout.widths) {
  test(`layout (${size.name} ${size.width}px): no side scroll, the day panel fits, tap targets ≥ ${RULES.layout.minTap}px; screenshot saved`, async ({ page, guard }) => {
    await open(page, guard, size);
    for (const tab of ['The round', 'Heat map', 'Year strip', 'Month cards']) {
      await page.getByRole('button', { name: tab }).click();
      const over = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
      expect(over, `${tab} scrolls sideways`).toBeLessThanOrEqual(0);
    }
    await page.getByRole('button', { name: 'Heat map' }).click();
    const small = await page.evaluate(({ min, exempt }) => {
      const bad = [];
      document.querySelectorAll('#main button, #main a, #main input, #main select, header a, header button, #drill button').forEach((e) => {
        if (exempt.some((s) => e.matches(s))) return;
        const r = e.getBoundingClientRect(), st = getComputedStyle(e);
        if (!r.width || st.visibility === 'hidden' || st.display === 'none' || e.closest('.view:not(.on)')) return;
        if (r.width < min || r.height < min) bad.push((e.className || e.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      });
      return bad;
    }, { min: RULES.layout.minTap, exempt: RULES.layout.tapExempt.concat(size.width >= 768 ? RULES.layout.desktopExempt : []) });
    expect(small, 'tap targets too small').toEqual([]);
    await openDay(page, '2026-01-06');
    const box = await page.locator('#drill').boundingBox();
    const vw = page.viewportSize().width;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw + 0.5);
    const dir = process.env.HISTORY_SHOTS_DIR || test.info().outputDir;
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `history-${size.name}-day-panel.png`), fullPage: false });
    await page.locator('#drill .dclose').click();
    await page.getByRole('button', { name: 'The round' }).click();
    await page.locator('#rdate').fill('2026-01-10');
    await page.locator('#rdate').dispatchEvent('change');
    await page.screenshot({ path: path.join(dir, `history-${size.name}-round.png`), fullPage: true });
  });
}

// ------------------------------------------------------------------ INFORMATION
test('information: one short line per room, a tick inside the limit, the unit once, outside as max / min and rain, DD/MM/YY', async ({ page, guard }) => {
  await open(page, guard);
  await openDay(page, '2026-01-05');
  const drill = page.locator('#drill');
  await expect(drill.locator('#d-title')).toHaveText(RULES.words.dayTitle);
  await expect(drill.locator('#d-title')).toHaveText('05/01/26');
  await expect(drill.locator('#d-out')).toHaveText('5.3 / -1.9 °C, rain 0 mm');
  await expect(drill.locator('#d-out')).toHaveText(RULES.words.outsideLine);
  const lines = drill.locator('.rl');
  await expect(lines).toHaveText(['R1 · AM 12.0–15.0 ✓ · PM 12.5–16.0 ✓', 'R2 · AM 12.0–15.0 ✓ · PM 12.5–16.0 ✓', 'R3 · AM 12.0–15.0 ✓ · PM 12.5–16.0 ✓', 'R4 (retired 10/01/26) · AM 12.0–15.0 ✓ · PM 12.5–16.0 ✓']);
  for (const t of await lines.allTextContents()) { expect(t).toMatch(RULES.words.roomLine); expect(t).not.toContain('°C'); }
  await expect(drill.getByText('Indoors °C')).toHaveCount(1);
  for (const view of ['The round', 'Heat map', 'Year strip', 'Month cards']) {
    if (await page.locator('#drill .dclose').isVisible()) await page.locator('#drill .dclose').click();
    await page.getByRole('button', { name: view }).click();
    const text = (await page.locator('#main').innerText()) + ' ' + (await page.locator('#drill').innerText());
    for (const re of RULES.words.never) expect(text, `${view} shows ${re}`).not.toMatch(re);
    if (view === 'Heat map') await openDay(page, '2026-01-06');
  }
});

// ------------------------------------------------------------------ COLOUR / ALARM
test('colour: no red anywhere; orange only for outside-limit or missed; the outside calendar uses no warning colour; every colour is a house token', async ({ page, guard }) => {
  await open(page, guard);
  for (const view of ['The round', 'Heat map', 'Year strip', 'Month cards']) {
    await page.getByRole('button', { name: view }).click();
    if (view === 'Heat map') await openDay(page, '2026-01-06');
    const found = await page.evaluate((C) => {
      const probe = document.createElement('i'); document.body.appendChild(probe);
      const val = (v) => { probe.style.color = 'var(' + v + ')'; return getComputedStyle(probe).color; };
      const allowed = new Set(C.allowed.map(val).concat(['rgba(0, 0, 0, 0)']));
      const red = new Set(C.never.map(val)), warn = new Set(C.warnOnly.map(val)), outNever = new Set(C.outsideCalendarNever.map(val));
      probe.remove();
      const bad = [];
      document.querySelectorAll('body *').forEach((e) => {
        const r = e.getBoundingClientRect(), st = getComputedStyle(e);
        if (!r.width || !r.height || st.visibility === 'hidden' || e.closest('.view:not(.on)') || e.closest('svg') || e.closest('#boot')) return;
        if (e.closest('#drill') && !document.getElementById('drill').classList.contains('open')) return;
        const cols = [st.backgroundColor];
        if (e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) cols.push(st.color);
        if (parseFloat(st.borderTopWidth) > 0 && st.borderTopStyle !== 'none') cols.push(st.borderTopColor);
        if (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0) cols.push(st.outlineColor);
        const name = e.tagName.toLowerCase() + '.' + String(e.className).replace(/\s+/g, '.');
        for (const c of cols) {
          if (red.has(c)) bad.push('red on ' + name);
          else if (!allowed.has(c)) bad.push('colour ' + c + ' on ' + name);
          else if (warn.has(c) && !e.closest('.warn') && !e.classList.contains('miss') && !(e.classList.contains('leg-sq') && e.closest('.legend'))) bad.push('orange without a warning on ' + name);
          if (outNever.has(c) && e.closest('[data-cal="out"]')) bad.push('warning colour on the outside calendar: ' + name);
        }
      });
      return [...new Set(bad)];
    }, RULES.colour);
    expect(found, view).toEqual([]);
    if (view === 'Heat map') await page.locator('#drill .dclose').click();
  }
  // The hot outside day (07/01, 24 °C) is a calm colour, not a warning.
  await page.getByRole('button', { name: 'Heat map' }).click();
  await expect(page.locator('#view-a [data-cal="out"] button.d[title^="7 Jan 2026"]')).toHaveClass(/owarm/);
});

// ------------------------------------------------------------------ AUDIT
test('audit: each day matches its rows; missed only where needed; outside-limit shows what was done; month totals equal the rows', async ({ page, guard }) => {
  await open(page, guard);
  await page.getByRole('button', { name: 'Heat map' }).click();
  const state = async (iso) => (await day(page, iso).getAttribute('class')).split(' ')[1];
  expect(await state('2026-01-04')).toBe('nd');      // before any room was in use: nothing needed, no alarm
  expect(await state('2026-01-05')).toBe('allok');
  expect(await state('2026-01-06')).toBe('warn');    // R2 AM outside the limit
  expect(await state('2026-01-07')).toBe('miss');    // R3 PM missed
  expect(await state('2026-01-08')).toBe('miss');    // nothing read, rooms in use
  expect(await state('2026-01-12')).toBe('allok');   // today: AM all read, PM still due
  for (const [cls, word] of Object.entries(RULES.audit.dayStates)) {
    const one = page.locator(`#view-a [data-cal="indoors"] button.d.${cls}`).first();
    if (await one.count()) await expect(one).toHaveAttribute('aria-label', new RegExp(word + '$'));
  }

  await openDay(page, '2026-01-06');
  await expect(page.locator('#drill .rl', { hasText: 'R2' })).toContainText('AM 14.0–27.0');
  await expect(page.locator('#drill .rl', { hasText: 'R2' }).locator('.warn').first()).toHaveText('AM 14.0–27.0');
  await expect(page.locator('#drill .rl', { hasText: 'R2' })).toContainText('AM what was done: Fan on, door open');
  await page.locator('#drill .dclose').click();
  await openDay(page, '2026-01-10');
  await expect(page.locator('#drill .rl', { hasText: 'R1' })).toContainText('PM 9.0–14.0');
  await expect(page.locator('#drill .rl', { hasText: 'R1' })).not.toContainText('what was done');
  await page.locator('#drill .dclose').click();
  await openDay(page, '2026-01-07');
  await expect(page.locator('#drill .rl', { hasText: 'R3' }).locator('.warn')).toHaveText('PM missed');
  await page.locator('#drill .dclose').click();

  // The retired room is never missed after its last reading (10/01).
  await page.getByRole('button', { name: 'The round' }).click();
  await page.locator('#rdate').fill('2026-01-11');
  await page.locator('#rdate').dispatchEvent('change');
  await expect(page.locator('#view-d .rtile .rn')).toHaveText(['R1', 'R2', 'R3']);
  await page.locator('#rdate').fill('2026-01-12');
  await page.locator('#rdate').dispatchEvent('change');
  await expect(page.locator('#view-d .rtile').first()).toContainText('PM due');
  await expect(page.locator('#view-d .rtile').first().locator('.warn')).toHaveCount(0);

  const want = expected();
  await page.getByRole('button', { name: 'Month cards' }).click();
  const jan = page.locator('#view-c .mitem[data-month="1"]');
  await expect(jan).toHaveAttribute('data-read', String(want.read));
  await expect(jan).toHaveAttribute('data-out', String(want.out));
  await expect(jan).toHaveAttribute('data-miss', String(want.miss));
  await expect(jan).toContainText(`${want.read - want.out} in limit`);
  await expect(jan).toContainText(`${want.out} outside`);
  await expect(jan).toContainText(`${want.miss} missed`);
  await expect(jan).toContainText(`${Math.round(100 * (want.read - want.out) / (want.read + want.miss))}% in limit`);
  // quality review 12 Nov: no card for a month that has not started; a card opens its month on the heat map
  await expect(page.locator('#view-c .mitem')).toHaveCount(1);
  await jan.click();
  await expect(page.locator('#view-a')).toBeVisible();
  await expect(page.locator('#view-a .mc[data-m="1"]').first()).toBeInViewport();
});

test('phone: the round shows room cards only, never the table beside them (quality review 12 Nov)', async ({ page, guard }) => {
  await open(page, guard, { width: 390, height: 844 });
  await expect(page.locator('#view-d .rtile').first()).toBeVisible();
  await expect(page.locator('#view-d .rscroll')).toBeHidden();
});

// Found by the click-crawl, 13 Nov 2026: later days and days with no readings were buttons that did nothing when tapped.
test('heat map: a day with nothing to open is not a button you can press; every day you can press opens its panel', async ({ page, guard }) => {
  await open(page, guard);
  await page.getByRole('button', { name: 'Heat map' }).click();
  const cells = page.locator('#view-a button.d');
  await expect(cells.first()).toBeVisible();
  const kinds = await cells.evaluateAll((list) => list.map((b) => ({ blank: /(^|\s)(future|nd)(\s|$)/.test(b.className), disabled: b.disabled, opens: !!b.getAttribute('onclick') })));
  expect(kinds.length).toBeGreaterThan(300);
  expect(kinds.filter((k) => k.blank).length, 'the sample year has later days or days with no readings').toBeGreaterThan(0);
  expect(kinds.filter((k) => k.blank && !k.disabled), 'a blank day must not be pressable').toEqual([]);
  expect(kinds.filter((k) => !k.blank && (k.disabled || !k.opens)), 'a day with readings must open its panel').toEqual([]);
  // every blank day still says what it is (for a screen reader and on hover)
  await expect(page.locator('#view-a button.d.future').first()).toHaveAttribute('aria-label', /Later$/);
});

test('audit: a room in use with no readings at all is listed and shows missed, never hidden', async ({ page, guard }) => {
  await open(page, guard, null, ROOMS + 'area-r5,R5,5\n');
  await page.locator('#rdate').fill('2026-01-11');
  await page.locator('#rdate').dispatchEvent('change');
  await expect(page.locator('#view-d .rtile .rn')).toHaveText(['R1', 'R2', 'R3', 'R5']);
  await expect(page.locator('#view-d .rtile', { hasText: 'R5' }).locator('.warn')).toHaveText(['AM missed', 'PM missed']);
  await page.getByRole('button', { name: 'Heat map' }).click();
  expect((await day(page, '2026-01-05').getAttribute('class')).split(' ')[1]).toBe('miss');   // R5 missed from the first reading day
  expect((await day(page, '2026-01-04').getAttribute('class')).split(' ')[1]).toBe('nd');     // nothing before readings began
  await page.getByRole('button', { name: 'Month cards' }).click();
  const want = expected();
  await expect(page.locator('#view-c .mitem[data-month="1"]')).toHaveAttribute('data-miss', String(want.miss + 15));   // R5: 7 days x 2 + today AM
});

module.exports = { RULES };

// Room empty (Lisa 11 Nov 2026): no dog present, a flag on the slot's reading. With no reading the slot is covered
// (never missed); outside the limit while empty is flagged "Room empty" but never counted as outside the limit.
test('audit: Room empty is covered, never missed; an outside reading in an empty room is flagged but not counted', async ({ page, guard }) => {
  const extra = '\nrdg-e1,area-r3,2026-01-07T16:00:00Z,2026-01-07T12:00:00+00:00,,,,,stf-1,,yes'
    + '\nrdg-e2,area-r1,2026-01-08T09:00:00Z,2026-01-08T00:00:00+00:00,8.0,14.0,typed,,stf-1,,yes'
    + '\nrdg-e3,area-r2,2026-01-08T09:00:00Z,2026-01-08T00:00:00+00:00,12.0,15.0,typed,,stf-1,,yes';
  const readings = READINGS.replace('mitigation_note\n', 'mitigation_note,room_empty\n').trimEnd().split('\n')
    .map((l, i) => (i === 0 ? l : l + ',')).join('\n') + extra + '\n';
  const put = (name, content) => { const f = guard.world.files.find((x) => x.name === name); f.content = content; f.size = String(content.length); };
  await open(page, guard);
  put('BLD-area_reading.csv', readings);
  await page.reload();
  await expect(page.locator('#livepill')).toHaveText('Up to date', LOADED);
  await page.locator('.yr-btn[data-yr="2026"]').click();
  await openDay(page, '2026-01-07');
  await expect(page.locator('#drill .rl', { hasText: 'R3' })).toContainText('PM empty');
  await expect(page.locator('#drill .rl', { hasText: 'R3' }).locator('.warn')).toHaveCount(0);
  await page.locator('#drill .dclose').click();
  expect((await day(page, '2026-01-07').getAttribute('class')).split(' ')[1]).toBe('allok');   // the only gap was an empty room
  await openDay(page, '2026-01-08');
  await expect(page.locator('#drill .rl', { hasText: 'R1' }).locator('.warn').first()).toHaveText('AM 8.0–14.0 · Room empty');
  await expect(page.locator('#drill .rl', { hasText: 'R1' })).not.toContainText('what was done');
  await expect(page.locator('#drill .rl', { hasText: 'R2' })).toContainText('AM 12.0–15.0 ✓ (empty)');
  await page.locator('#drill .dclose').click();
  const want = expected();
  await page.getByRole('button', { name: 'Month cards' }).click();
  const jan = page.locator('#view-c .mitem[data-month="1"]');
  await expect(jan).toHaveAttribute('data-out', String(want.out));          // the empty room's outside reading is not counted
  await expect(jan).toHaveAttribute('data-read', String(want.read + 2));
  await expect(jan).toHaveAttribute('data-miss', String(want.miss - 3));    // R3 PM 07/01, R1 and R2 AM 08/01 covered
});

// Two named thermometers in one room (Lisa 11 Nov 2026, H5/6): one line each, "H5/6 · H5" and "H5/6 · H6", each
// missed on its own. An older reading with no thermometer_id still counts for a room with only one thermometer.
test('audit: a room with two thermometers has a line per thermometer; a blank thermometer_id counts for a one-thermometer room', async ({ page, guard }) => {
  const rooms = 'id,code,group_sort\narea-h,H5/6,1\narea-s,S1,2\n';
  const thermos = 'id,tenant_id,name,area_id\nth-h6,t,H6,area-h\nth-h5,t,H5,area-h\nth-s,t,S1,area-s\n';
  const readings = 'id,area_id,taken_at,period_start,min_c,max_c,read_method,thermometer_id\n'
    + 'rdg-1,area-h,2026-01-12T09:00:00Z,2026-01-12T00:00:00+00:00,12.0,15.0,camera,th-h5\n'
    + 'rdg-2,area-s,2026-01-12T09:00:00Z,2026-01-12T00:00:00+00:00,12.0,15.0,camera,\n';
  const put = (name, content) => { const f = guard.world.files.find((x) => x.name === name); f.content = content; f.size = String(content.length); };
  await open(page, guard, null, rooms);
  put('BLD-area_reading.csv', readings);
  const a0 = guard.world.files.find((x) => x.name === 'BLD-area.csv');
  guard.world.file('bld-thermo', 'BLD-thermometer.csv', thermos, { parents: a0.parents.slice(), driveId: a0.driveId, mimeType: 'text/csv' });
  await page.reload();
  await expect(page.locator('#livepill')).toHaveText('Up to date', LOADED);
  await page.locator('#rdate').fill('2026-01-12');
  await page.locator('#rdate').dispatchEvent('change');
  await expect(page.locator('#view-d .rtile .rn')).toHaveText(['H5/6 · H5', 'H5/6 · H6', 'S1']);
  await expect(page.locator('#view-d .rtile', { hasText: 'H5/6 · H5' }).locator('.warn')).toHaveCount(0);
  await expect(page.locator('#view-d .rtile', { hasText: 'H5/6 · H6' }).locator('.warn')).toHaveText(['AM missed']);
  await expect(page.locator('#view-d .rtile', { hasText: 'S1' }).locator('.warn')).toHaveCount(0);
});

// Links (Lisa 12 Nov 2026, "I need the temps to show continuously"): BLD-area_link rows make an old room's readings
// show for the room it became. A split room shows in both new rooms; a merged room shows the widest of its old
// readings (lowest MIN, highest MAX), never an average. The old rooms keep their own lines; nothing is rewritten.
test('audit: area links show old rooms\' readings in the new rooms, widest for a merged slot', async ({ page, guard }) => {
  const rooms = 'id,code,group_sort\nold-a,3B.1/2,1\nold-s,3B.3/4,2\nnew-1,3B.1/2/3,3\nnew-2,3B.4/5,4\n';
  const links = 'id,tenant_id,from_area_id,to_area_id,from_date,to_date\n'
    + 'l1,t,old-a,new-1,2025-01-01,2026-01-12\nl2,t,old-s,new-1,2025-01-01,2026-01-12\nl3,t,old-s,new-2,2025-01-01,2026-01-12\n';
  const readings = 'id,area_id,taken_at,period_start,min_c,max_c,read_method,thermometer_id\n'
    + 'rdg-1,old-a,2026-01-12T09:00:00Z,2026-01-12T00:00:00+00:00,12.0,15.0,typed,\n'
    + 'rdg-2,old-s,2026-01-12T09:05:00Z,2026-01-12T00:00:00+00:00,10.0,14.0,typed,\n'
    + 'rdg-3,old-s,2026-01-13T09:05:00Z,2026-01-13T00:00:00+00:00,11.0,13.0,typed,\n';
  const put = (name, content) => { const f = guard.world.files.find((x) => x.name === name); f.content = content; f.size = String(content.length); };
  await open(page, guard, null, rooms);
  put('BLD-area_reading.csv', readings);
  const a0 = guard.world.files.find((x) => x.name === 'BLD-area.csv');
  guard.world.file('bld-links', 'BLD-area_link.csv', links, { parents: a0.parents.slice(), driveId: a0.driveId, mimeType: 'text/csv' });
  await page.reload();
  await expect(page.locator('#livepill')).toHaveText('Up to date', LOADED);
  await page.locator('#rdate').fill('2026-01-12');
  await page.locator('#rdate').dispatchEvent('change');
  await expect(page.locator('#view-d .rtile', { hasText: '3B.1/2/3 (from 3B.1/2, 3B.3/4)' })).toContainText('10.0–15.0');
  await expect(page.locator('#view-d .rtile', { hasText: '3B.4/5 (from 3B.3/4)' })).toContainText('10.0–14.0');
  await expect(page.locator('#view-d .rtile', { hasText: /^3B\.1\/2\b/ }).first()).toBeVisible();
  // after the link's to_date the old room's reading stays only on the old room
  await page.locator('#rdate').fill('2026-01-13');
  await page.locator('#rdate').dispatchEvent('change');
  await expect(page.locator('#view-d .rtile', { hasText: '(from' })).toHaveCount(0);
});

// Lisa 12 Nov 2026 (every limit is a dated row; overseer sweep T4): a room is judged by the band for the youngest dog in
// it that day, as the staff round and the hub do, never by the adult band alone. Invented dog and rows only.
test('audit: a room holding a puppy under 4 weeks is judged by the puppy band that day; an adult room by the adult band', async ({ page, guard }) => {
  const bands = 'id,band,age_from_days,age_to_days,min_temp,max_temp,from_date,to_date\n'
    + 'tb-p,Puppy,0,28,26,28,,\ntb-a,Adult,29,,10,26,,\n';
  const subj = 'id,tenant_id,name,sex,dob\npup-1,t,Pup,F,2026-01-01\n';
  const occ = 'id,tenant_id,subject_id,area_id,off_site_kind,moved_in,moved_out\nocc-1,t,pup-1,area-r1,,2026-01-01,\n';
  await open(page, guard);
  const a0 = guard.world.files.find((x) => x.name === 'BLD-area.csv');
  const upsert = (id, name, content) => {
    const f = guard.world.files.find((x) => x.name === name);
    if (f) { f.content = content; f.size = String(content.length); }
    else guard.world.file(id, name, content, { parents: a0.parents.slice(), driveId: a0.driveId, mimeType: 'text/csv' });
  };
  upsert('bld-band', 'BLD-temperature_band.csv', bands);
  upsert('bld-subj', 'BLD-subject.csv', subj);
  upsert('bld-occ', 'BLD-occupancy.csv', occ);
  await page.reload();
  await expect(page.locator('#livepill')).toHaveText('Up to date', LOADED);
  await page.locator('.yr-btn[data-yr="2026"]').click();
  await openDay(page, '2026-01-05');
  // R1 holds a 4-day-old puppy: 12.0–15.0 is outside 26–28
  await expect(page.locator('#drill .rl', { hasText: 'R1' }).locator('.warn').first()).toContainText('12.0–15.0');
  // R2 has no dogs: the adult band, 12.0–15.0 is in
  await expect(page.locator('#drill .rl', { hasText: 'R2' })).toContainText('AM 12.0–15.0 ✓');
  await expect(page.locator('#drill .rl', { hasText: 'R2' }).locator('.warn')).toHaveCount(0);
});

test('audit: a reading with max lower than min is flagged, even when both figures are inside the limit', async ({ page, guard }) => {
  const rows = R.map((r, i) => {
    if (r[0] === 'area-r1' && r[1] === '2026-01-05' && r[2] === 'am') return ['area-r1', '2026-01-05', 'am', '22.0', '18.0', ''];
    return r;
  });
  const readings = 'id,area_id,taken_at,period_start,min_c,max_c,read_method,camera_value_changed,taken_by,mitigation_note\n'
    + rows.map((r, i) => ['rdg-' + i, r[0], r[1] + 'T' + (r[2] === 'am' ? '09' : '16') + ':00:00Z', r[1] + 'T' + (r[2] === 'am' ? '00' : '12') + ':00:00+00:00', r[3], r[4], 'camera', 'true', 'stf-1', '"' + r[5] + '"'].join(',')).join('\n') + '\n';
  await open(page, guard);
  const put = (name, content) => { const f = guard.world.files.find((x) => x.name === name); f.content = content; f.size = String(content.length); };
  put('BLD-area_reading.csv', readings);
  await page.reload();
  await expect(page.locator('#livepill')).toHaveText('Up to date', LOADED);
  await page.locator('.yr-btn[data-yr="2026"]').click();
  expect((await day(page, '2026-01-05').getAttribute('class')).split(' ')[1]).toBe('warn');
  await openDay(page, '2026-01-05');
  const r1 = page.locator('#drill .rl', { hasText: 'R1' });
  await expect(r1.locator('.warn').first()).toHaveText('AM 22.0–18.0 · max lower than min');
  await expect(r1).toContainText('PM 12.5–16.0 ✓');
  await expect(r1).not.toContainText('AM 22.0–18.0 ✓');
  const dir = process.env.MINMAX_SHOTS_DIR || test.info().outputDir;
  fs.mkdirSync(dir, { recursive: true });
  await page.locator('#drill').screenshot({ path: path.join(dir, 'history-swapped.png') });
  await page.locator('#drill .dclose').click();
  await page.getByRole('button', { name: 'The round' }).click();
  await page.locator('#rdate').fill('2026-01-05');
  await page.locator('#rdate').dispatchEvent('change');
  await expect(page.locator('#view-d .rtile', { hasText: 'R1' }).locator('.warn')).toContainText('AM 22.0–18.0 · max lower than min');
  await page.screenshot({ path: path.join(dir, 'history-round-swapped.png'), fullPage: true });
  await page.getByRole('button', { name: 'Month cards' }).click();
  await expect(page.locator('#view-c .mitem[data-month="1"]')).toHaveAttribute('data-swap', '1');
  await expect(page.locator('#view-c .mitem[data-month="1"]')).toContainText('1 max lower than min');
});

// Lisa 12 Nov 2026 (t957u/t958u): July/August cells take their colour from the day's readings and the standing
// limits (empty from_date / to_date, as on the live band table). Invented rooms and figures only. Outside the
// limit is solid orange (.warn); a missed needed reading is an orange outline (.miss). The day panel does not
// repeat empty "what was done" lines or "(from …)" source text.
test('audit: July and August indoor days colour from the readings; missed is an outline, outside-limit is solid', async ({ page, guard }) => {
  const rows = R.slice();
  const addRow = (aid, day, slot, min, max, note) => rows.push([aid, day, slot, min, max, note || '']);
  for (const aid of ['area-r1', 'area-r2', 'area-r3']) {
    addRow(aid, '2026-07-10', 'am', aid === 'area-r1' ? '25.0' : '18.0', aid === 'area-r1' ? '28.2' : '22.0');
    addRow(aid, '2026-07-10', 'pm', '18.0', '22.0');
    addRow(aid, '2026-07-12', 'am', '18.0', '22.0');
    addRow(aid, '2026-07-12', 'pm', '18.0', '22.0');
    addRow(aid, '2026-08-10', 'am', '12.0', '15.0');
    addRow(aid, '2026-08-10', 'pm', '12.5', '16.0');
  }
  const readings = 'id,area_id,taken_at,period_start,min_c,max_c,read_method,camera_value_changed,taken_by,mitigation_note\n'
    + rows.map((r, i) => ['rdg-' + i, r[0], r[1] + 'T' + (r[2] === 'am' ? '09' : '16') + ':00:00Z', r[1] + 'T' + (r[2] === 'am' ? '00' : '12') + ':00:00+00:00', r[3], r[4], 'camera', 'true', 'stf-1', '"' + r[5] + '"'].join(',')).join('\n') + '\n';
  const bands = 'id,band,age_from_days,age_to_days,min_temp,max_temp,from_date,to_date,note\n'
    + 'tb-p,under four weeks,0,28,26,28,,,""\n'
    + 'tb-a,four weeks and over,29,,10,26,,,"standing limit"\n';
  await open(page, guard, null, ROOMS, new Date('2026-11-12T20:00:00'));
  const a0 = guard.world.files.find((x) => x.name === 'BLD-area.csv');
  const upsert = (id, name, content) => {
    const f = guard.world.files.find((x) => x.name === name);
    if (f) { f.content = content; f.size = String(content.length); }
    else guard.world.file(id, name, content, { parents: a0.parents.slice(), driveId: a0.driveId, mimeType: 'text/csv' });
  };
  upsert('bld-readings', 'BLD-area_reading.csv', readings);
  upsert('bld-band', 'BLD-temperature_band.csv', bands);
  await page.reload();
  await expect(page.locator('#livepill')).toHaveText('Up to date', LOADED);
  await page.locator('.yr-btn[data-yr="2026"]').click();
  await page.getByRole('button', { name: 'Heat map' }).click();
  const dayM = (iso) => {
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+iso.slice(5, 7) - 1];
    return page.locator(`#view-a [data-cal="indoors"] button.d[title^="${+iso.slice(8)} ${mon} 2026 indoors"]`);
  };
  expect((await dayM('2026-07-10').getAttribute('class')).split(' ')[1]).toBe('warn');
  expect((await dayM('2026-07-11').getAttribute('class')).split(' ')[1]).toBe('miss');
  expect((await dayM('2026-08-10').getAttribute('class')).split(' ')[1]).toBe('allok');
  await expect(page.locator('.legend')).toContainText('Outside limit');
  await expect(page.locator('.legend')).toContainText('Missed');
  await expect(page.locator('.legend')).not.toContainText('Outside limit or missed');
  const paint = (iso) => dayM(iso).evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, shadow: s.boxShadow };
  });
  const julyWarn = await paint('2026-07-10');
  const julyMiss = await paint('2026-07-11');
  expect(julyWarn.bg, 'outside limit is a solid fill, missed is not').not.toBe(julyMiss.bg);
  expect(julyMiss.shadow, 'a missed day keeps an orange frame').toContain('rgb');
  await dayM('2026-07-10').click();
  await expect(page.locator('#drill')).toBeVisible();
  const drillBox = await page.locator('#drill').evaluate((el) => {
    const s = getComputedStyle(el);
    return { radius: s.borderTopLeftRadius, border: s.borderTopWidth };
  });
  expect(drillBox.radius).not.toBe('0px');
  expect(drillBox.border).toBe('1px');
  const outLine = page.locator('#drill .rl', { hasText: 'R1' }).locator('.warn').first();
  await expect(outLine).toHaveText('AM 25.0–28.2');
  await expect(outLine).not.toHaveClass(/\bmiss\b/);
  await expect(page.locator('#drill')).not.toContainText('what was done');
  await expect(page.locator('#drill')).not.toContainText('(from');
  const rowFrame = await page.locator('#drill .rl').first().evaluate((el) => getComputedStyle(el).borderTopWidth);
  expect(rowFrame).toBe('1px');
  await page.locator('#drill .dclose').click();
  await dayM('2026-07-11').click();
  const missed = page.locator('#drill span.miss');
  await expect(missed.first()).toBeVisible();
  await expect(missed.first()).toHaveClass(/\bwarn\b/);
  expect(await page.locator('#drill span.warn').count()).toBe(await page.locator('#drill span.warn.miss').count());
  await page.locator('#drill .dclose').click();
  // A limit typed with from_date of today still colours a July reading (standing guidance, entered late).
  upsert('bld-band', 'BLD-temperature_band.csv', 'id,band,age_from_days,age_to_days,min_temp,max_temp,from_date,to_date\ntb-a,Adult,29,,10,26,2026-11-12,\n');
  await page.reload();
  await expect(page.locator('#livepill')).toHaveText('Up to date', LOADED);
  await page.locator('.yr-btn[data-yr="2026"]').click();
  await page.getByRole('button', { name: 'Heat map' }).click();
  expect((await dayM('2026-07-10').getAttribute('class')).split(' ')[1]).toBe('warn');
  // A puppy row already in force must not hide the adult row that was typed later. 18–22 is inside 10–26, so the day is in limit, not an uncoloured pale cell.
  upsert('bld-band', 'BLD-temperature_band.csv', 'id,band,age_from_days,age_to_days,min_temp,max_temp,from_date,to_date\n'
    + 'tb-p,under four weeks,0,28,26,28,,\n'
    + 'tb-a,four weeks and over,29,,10,26,2026-11-12,\n');
  await page.reload();
  await expect(page.locator('#livepill')).toHaveText('Up to date', LOADED);
  await page.locator('.yr-btn[data-yr="2026"]').click();
  await page.getByRole('button', { name: 'Heat map' }).click();
  expect((await dayM('2026-07-12').getAttribute('class')).split(' ')[1]).toBe('allok');
  const julyIn = await paint('2026-07-12');
  const bare = await dayM('2026-07-01').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(julyIn.bg, 'an in-limit July day is not the empty-cell fill').not.toBe(bare);
  expect(julyIn.shadow).not.toBe('none');
});
