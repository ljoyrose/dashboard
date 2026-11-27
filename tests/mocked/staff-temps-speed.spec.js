// Staff Temps, Jobs and the checks page (22 Nov 2026: Temps "Loading..." 45-110 s on EVERY open; checks blank).
// - Slow lists (rooms, dogs, bands, thermometers...) are read once a session and shared by every screen; readings and
//   job records are always read, and the round reads readings from yesterday on only.
// - A screen that waits for the records gives up after 45 s with a plain line and Try again; nothing is a blank page.
// Fake code and fake save address only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const TABLES = {
  area: [{ id: 'area-new', code: '3A.1/2', group_sort: '2' }],
  subject: [], occupancy: [], subject_status: [], check_type: [], check_log: [], area_capacity: [], area_access: [], litter: [], capacity_setting: [], qr_tag: [],
  temperature_band: [{ id: 'tb-1', band: 'Rest', age_from_days: '0', age_to_days: '', min_temp: '10', max_temp: '20' }],
  area_reading: [], thermometer: [{ id: 'thm-new', name: '3A.1/2', area_id: 'area-new' }],
  requirement: [{ id: 'req-2', need_type: 'reading.temperature', target_table: 'thermometer', target_id: 'thm-new', from_date: '2026-11-01', to_date: '' }]
};

async function setup(page, { hang } = {}) {
  const reads = [];
  const state = { hang: hang || null };
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'area_reading', on: true, mode: 'direct' }, { key: 'check_log', on: true, mode: 'direct' }] } });
    const b = JSON.parse(route.request().postData());
    if (String(b.action).indexOf('read') === 0) {
      reads.push({ table: b.table, filter: b.filter || null });
      if (state.hang && b.table === state.hang) return;   // never answers
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: TABLES[b.table] || [], role: 'OWNER' } } });
    }
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'rdg-1' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  return { reads, state };
}
const count = (reads, t) => reads.filter((r) => r.table === t).length;

test('Temps: reopening within 2 minutes reads nothing, later only the readings; the lists are kept for the session with "as of" and Refresh', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-12T09:00:00Z'));
  const { reads } = await setup(page);
  await page.goto('cdhub/staff/#m/temperature');
  await expect(page.locator('.cards .card .nm')).toHaveText(['3A.1/2']);
  const first = reads.length;
  for (const t of ['area', 'subject', 'thermometer', 'temperature_band']) expect(count(reads, t)).toBe(1);
  // the round reads readings from yesterday on only
  expect(reads.find((r) => r.table === 'area_reading').filter).toEqual({ from: '2026-11-11', to: '2026-11-13' });
  await expect(page.locator('[data-lists-asof]')).toContainText(/^Rooms and dogs as of \d\d:\d\d/);
  await page.evaluate(() => { location.hash = '#home'; });
  await page.evaluate(() => { location.hash = '#m/temperature'; });
  await expect(page.locator('.cards .card .nm')).toHaveText(['3A.1/2']);
  expect(reads.slice(first)).toEqual([]);   // reopened within 2 minutes: nothing is read again
  await page.evaluate(() => { location.hash = '#home'; });
  await page.clock.setFixedTime(new Date('2026-11-12T09:03:00Z'));   // after 2 minutes only the readings are read again
  await page.evaluate(() => { location.hash = '#m/temperature'; });
  await expect(page.locator('.cards .card .nm')).toHaveText(['3A.1/2']);
  expect(reads.slice(first).map((r) => r.table)).toEqual(['area_reading']);
  await page.locator('[data-lists-refresh]').click();
  await expect(page.locator('.cards .card .nm')).toHaveText(['3A.1/2']);
  expect(count(reads, 'area')).toBe(2);
});

test('Temps: a read that never answers shows a plain line with Try again within 45 s, not "Loading..." for ever', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-12T09:00:00Z') });
  const s = await setup(page, { hang: 'thermometer' });
  await page.goto('cdhub/staff/#m/temperature');
  await expect(page.locator('#screen')).toContainText('Loading...');
  await expect.poll(() => s.reads.some((r) => r.table === 'thermometer')).toBe(true);   // the hung read is out, so its 45 s has started
  await page.clock.runFor(46000);
  await expect(page.locator('[data-load-timeout]')).toHaveText('The records did not answer in 45 seconds. Nothing is lost. Try again.');
  s.state.hang = null;
  await page.locator('[data-load-retry]').click();
  await expect(page.locator('.cards .card .nm')).toHaveText(['3A.1/2']);
});

test('Jobs: a records read that never answers shows Try again within 45 s', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-12T09:00:00Z') });
  const s = await setup(page, { hang: 'check_type' });
  await page.goto('cdhub/staff/#m/jobs');
  await expect.poll(() => s.reads.some((r) => r.table === 'check_type')).toBe(true);   // the hung read is out, so its 45 s has started
  await page.clock.runFor(46000);
  await expect(page.locator('[data-load-timeout]')).toBeVisible();
  await expect(page.locator('[data-load-retry]')).toBeVisible();
  s.state.hang = null;
  await page.locator('[data-load-retry]').click();
  await expect(page.locator('[data-load-timeout]')).toHaveCount(0);
});

test('Checks page: retired (daily checks are on Jobs); it says it has moved and keeps the code', async ({ page }) => {
  await setup(page, {});
  await page.goto('cdhub/checks/');
  await expect(page.locator('body')).toContainText('This page has moved');
  expect(await page.evaluate(() => localStorage.getItem('bld.device.code'))).toBe('FAKE-CODE-1');
});

test('Temps: a reading kept on the phone is sent as soon as the page is shown again, not on a later timer @live', async ({ page, allowedConsole }) => {
  allowedConsole.push(/ERR_INTERNET_DISCONNECTED/, /Failed to load resource/);   // the save tried while the phone had no signal
  await page.clock.install({ time: new Date('2026-11-12T09:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-12T09:00:01Z'));   // timers only run when the test says so
  const sent = [], state = { offline: true };
  await setup(page);
  await page.route(SCRIPT, (route) => {
    if (route.request().method() !== 'GET') {
      const b = JSON.parse(route.request().postData());
      if (b.request_id === 'req-kept-test-0001') {
        if (state.offline) return route.abort('internetdisconnected');   // the phone has no signal while the page opens
        sent.push(b); return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'rdg-kept' } } });
      }
    }
    return route.fallback();
  });
  await page.addInitScript(() => {
    const body = { v: 1, request_id: 'req-kept-test-0001', table: 'area_reading', action: 'add', fields: { area_id: 'area-new', thermometer_id: 'thm-new', min_c: '12.0', max_c: '15.0', period_start: '2026-11-12T00:00:00+00:00' } };
    localStorage.setItem('bld.outbox', JSON.stringify([{ id: body.request_id, body, at: '2026-11-12T08:59:00Z' }]));
  });
  await page.goto('cdhub/staff/#m/temperature');
  await expect(page.locator('.cards .card .nm')).toHaveText(['3A.1/2']);
  await page.waitForLoadState('load');
  state.offline = false;   // signal back, but no timer runs: only showing the page again can send it now
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].code).toBe('FAKE-CODE-1');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bld.outbox'))).toBeNull();
});

test('Temps: as the phone locks, a kept reading is handed to the browser to send, and stays kept until answered @live', async ({ page, allowedConsole }) => {
  allowedConsole.push(/ERR_INTERNET_DISCONNECTED/, /Failed to load resource/);
  await page.clock.install({ time: new Date('2026-11-12T09:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-12T09:00:01Z'));   // no timer runs: only hiding the page can send
  const sent = [], state = { offline: true };
  await setup(page);
  await page.route(SCRIPT, (route) => {
    if (route.request().method() !== 'GET') {
      const b = JSON.parse(route.request().postData());
      if (b.request_id === 'req-kept-test-0002') {
        if (state.offline) return route.abort('internetdisconnected');
        sent.push(b); return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'rdg-kept' } } });
      }
    }
    return route.fallback();
  });
  await page.addInitScript(() => {
    const body = { v: 1, request_id: 'req-kept-test-0002', table: 'area_reading', action: 'add', fields: { area_id: 'area-new', thermometer_id: 'thm-new', min_c: '12.0', max_c: '15.0', period_start: '2026-11-12T00:00:00+00:00' } };
    localStorage.setItem('bld.outbox', JSON.stringify([{ id: body.request_id, body, at: '2026-11-12T08:59:00Z' }]));
  });
  await page.goto('cdhub/staff/#m/temperature');
  await expect(page.locator('.cards .card .nm')).toHaveText(['3A.1/2']);
  await page.waitForLoadState('load');
  state.offline = false;
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].code).toBe('FAKE-CODE-1');
  const kept = JSON.parse(await page.evaluate(() => localStorage.getItem('bld.outbox')));
  expect(kept.map((x) => [x.id, x.unsure])).toEqual([['req-kept-test-0002', true]]);   // leaves on the next normal send
});
