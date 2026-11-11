// Temperatures (History) page: layout, information, colour and audit rules (Lisa, 11 Nov 2026:
// "the info i need without looking alarming"). Pretend Drive only; every row here is invented.
// RULES is the one list later screens reuse (round, year report, prints).
const { test, expect } = require('../support/test');
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
    warnOnly: ['--ljr-3', '--ljr-3-text'],   // orange: only on .warn (outside limit, missed) and its legend swatch
    outsideCalendarNever: ['--ljr-3', '--ljr-3-text', '--ljr-2', '--ljr-2-text'],
  },
  audit: {
    dayStates: { allok: 'In limit', warn: 'Check', nd: 'No readings', nolimit: 'No limit set' },
  },
};

// Fixture month: Jan 2026. Today is 12/01/26 at 20:00 (PM today is still due).
// R1-R3 in use from 05/01; ZZ_R4 retired, last reading 10/01 (so never missed after that).
const NOW = new Date('2026-01-12T20:00:00');
const ROOMS = 'id,code,group_sort\narea-r1,R1,1\narea-r2,R2,2\narea-r3,R3,3\narea-r4,ZZ_R4,4\n';
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

async function open(page, guard, size) {
  const put = (name, content) => { const f = guard.world.files.find((x) => x.name === name); f.content = content; f.size = String(content.length); };
  put('BLD-area.csv', ROOMS);
  put('BLD-area_reading.csv', READINGS);
  await page.clock.setFixedTime(NOW);
  if (size) await page.setViewportSize({ width: size.width, height: size.height });
  await page.addInitScript(() => localStorage.setItem('ljr-dash-auth', JSON.stringify({ access_token: 'FAKE-TEST-TOKEN', expires_at: Date.now() + 1800000, scope: 'https://www.googleapis.com/auth/drive.readonly' })));
  await page.route(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export\?/, (route) => route.fulfill({ status: 200, contentType: 'text/csv', body: OUTDOOR }));
  await page.goto('cdhub/history.html');
  await expect(page.locator('#livepill')).toHaveText('Up to date');
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
  await expect(lines).toHaveText(['R1 · AM 12.0–15.0 ✓ · PM 12.5–16.0 ✓', 'R2 · AM 12.0–15.0 ✓ · PM 12.5–16.0 ✓', 'R3 · AM 12.0–15.0 ✓ · PM 12.5–16.0 ✓', 'ZZ_R4 · AM 12.0–15.0 ✓ · PM 12.5–16.0 ✓']);
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
          else if (warn.has(c) && !e.closest('.warn') && !(e.classList.contains('leg-sq') && e.closest('.legend'))) bad.push('orange without a warning on ' + name);
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
  expect(await state('2026-01-07')).toBe('warn');    // R3 PM missed
  expect(await state('2026-01-08')).toBe('warn');    // nothing read, rooms in use
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
  await expect(page.locator('#drill .rl', { hasText: 'R1' })).toContainText('PM what was done: not recorded');
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
  await expect(jan).toContainText(`${want.read} read`);
  await expect(jan).toContainText(`${want.out} outside limit`);
  await expect(jan).toContainText(`${want.miss} missed`);
});

module.exports = { RULES };
