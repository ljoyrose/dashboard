// The Round on the staff page (cdhub/staff: Temps, and Scan and move): every button, with the save script pretend.
// Each save is tried three ways: the script says OK, the script cannot be reached, the script refuses the entry.
// A card may tick only after the save reply is OK (the owner, 12 Nov 2026, PR 473). Invented rooms and dogs only
// (tests/fixtures/cdhub-27); the code and the save address are made up.
const { test, expect } = require('../support/test');
const c27 = require('../support/cdhub27');

test.use({ viewport: { width: 390, height: 800 } });
// The staff page asks for optional helper files (404), and the FAIL cases make the browser log the failed save.
test.beforeEach(async ({ allowedConsole }) => { allowedConsole.push(/404/, /500/, /ERR_FAILED/); });

const NO_REACH = 'No answer yet. It is kept on this phone and sent again by itself, so do not type it again.';
const card = (page, name) => page.locator('.cards .card', { has: page.locator('.nm', { hasText: new RegExp('^(✓ )?' + name + '$') }) });
// The words on a card change from time to time (Done 08:05, a tick, a date style). What must hold is the state:
// a card is done (class tg-done) or it is not, and its line carries the reading.
const DONE = /(^|\s)tg-done(\s|$)/;

async function round(page, opts) {
  await page.clock.setFixedTime(c27.NOW);
  const script = await c27.staffScript(page, opts);
  if (opts && opts.tables) opts.tables(script.tables);   // a test may change the invented rows before the page reads them
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('cdhub/staff/#m/temperature');
  await expect(page.getByRole('heading', { name: 'Room temperatures' })).toBeVisible();
  return { script, errors };
}
const openRoom = async (page, name) => { await card(page, name).click(); await expect(page.getByRole('heading', { name })).toBeVisible(); };
const typeReading = async (page, max, min) => {
  await expect(page.getByLabel('MAX')).toBeVisible();   // the MAX and MIN boxes are open at once (18 Nov 2026); there is no "Type it" step any more
  await page.getByLabel('MAX').fill(max);
  await page.getByLabel('MIN').fill(min);
};
const save = (page) => page.getByRole('button', { name: 'Save', exact: true });
// The three buttons under the room list, by the words they have carried (they were renamed on 14 Nov 2026).
const EARLIER = /^(Earlier|Add earlier reading)$/, REPORT = /^(Report|Year report)$/, IMPORT = /^(Import|Sensor CSV|Load readings file)$/;

test.describe('The Round: the room list', () => {
  test('starts on this morning, lists every thermometer needed today, and says what each one still needs', async ({ page }) => {
    const { errors } = await round(page);
    await expect(page.locator('#screen .sub').first()).toContainText('Morning');
    const names = (await page.locator('.cards .card .nm').allTextContents()).map((t) => t.replace(/^✓ /, ''));
    expect(names).toEqual(['Room 1 · Room 1 door', 'Room 1 · Room 1 window', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6']);
    const lines = await page.locator('.cards .card').allTextContents();   // the whole card: its name and its state line
    [0, 1, 5, 6].forEach((i) => expect(lines[i]).toContain('Due'));
    expect(lines[2]).toContain('12.5–18.0');
    expect(lines[3]).toContain('15.0–28.5');   // too warm is a cooling action, not "Outside" (the one temperature rule, 16 Nov 2026); too cold is tested below
    expect(lines[4]).toContain('Room empty');
    for (const [name, done] of [['Room 2', true], ['Room 3', true], ['Room 4', true], ['Room 5', false], ['Room 6', false]]) {
      if (done) await expect(card(page, name)).toHaveClass(DONE); else await expect(card(page, name)).not.toHaveClass(DONE);
    }
    await expect(page.locator('.cards')).not.toContainText('Room 8');   // retired: not in today's round
    expect(errors).toEqual([]);
  });

  test('every room card opens that room, and Rooms goes back to the list (next and previous)', async ({ page }) => {
    const { errors } = await round(page);
    const names = await page.locator('.cards .card .nm').allTextContents();
    expect(names.length).toBe(7);
    for (let i = 0; i < names.length; i++) {
      await page.locator('.cards .card').nth(i).click();
      await expect(page.locator('#screen h2')).toHaveText(names[i].replace(/^✓ /, ''));
      await expect(page.locator('#screen .sub').first()).toContainText('Morning reading');
      await page.getByRole('button', { name: '← Rooms' }).click();
      await expect(page.getByRole('heading', { name: 'Room temperatures' })).toBeVisible();
    }
    await page.getByRole('button', { name: '← Home' }).click();
    await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible();
    await page.locator('[data-module="temperature"]').click();   // Home's Temps card starts the round again
    await expect(page.getByRole('heading', { name: 'Room temperatures' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('The Round: recording a reading', () => {
  test('save OK: Saved, then CLR pressed finishes; the card ticks as soon as the reply is OK, before CLR is pressed', async ({ page }) => {
    const { script, errors } = await round(page);
    await openRoom(page, 'Room 5');
    await typeReading(page, '18.5', '12.0');
    await save(page).click();
    await expect(page.locator('.tg-clr')).toContainText('✓ Saved');
    await expect(page.getByText('Now press CLR on the thermometer.')).toBeVisible();
    expect(script.sent).toHaveLength(1);
    expect(script.sent[0]).toMatchObject({ table: 'area_reading', fields: { area_id: 'ar-5', thermometer_id: 'thm-5', max_c: '18.5', min_c: '12.0', read_method: 'typed', period_start: '2026-03-10T00:00:00+00:00' } });
    expect(script.sent[0].code).toBe(c27.CODE);
    // the tick does not wait for CLR pressed (PR 473): going back now already shows it
    await page.getByRole('button', { name: '← Rooms' }).click();
    await expect(card(page, 'Room 5')).toHaveClass(DONE);
    await expect(card(page, 'Room 5')).toContainText('12.0–18.5');
    // and the finish button does the same from the saved screen
    await openRoom(page, 'Room 6');
    await typeReading(page, '25.0', '24.0');   // inside the room limit (10.0 to 26.0): the room is judged on the adult row, the puppy row is for the bed spot
    await save(page).click();
    await page.getByRole('button', { name: 'CLR pressed' }).click();
    await expect(page.getByRole('heading', { name: 'Room temperatures' })).toBeVisible();
    await expect(card(page, 'Room 6')).toHaveClass(DONE);
    expect(errors).toEqual([]);
  });

  for (const [how, mode, words] of [['the save script cannot be reached', 'offline', NO_REACH], ['the save script answers with an error', 'fail', NO_REACH], ['the save script refuses the entry', 'refused', 'Check the entry.']]) {
    test(`save FAIL (${how}): it says so, nothing ticks, and the same press saves once it works`, async ({ page }) => {
      const { script, errors } = await round(page);
      await openRoom(page, 'Room 5');
      await typeReading(page, '18.5', '12.0');
      script.mode.save = mode;
      await save(page).click();
      await expect(page.locator('#screen .msg').last()).toHaveText(words);
      await expect(page.locator('.tg-clr')).toHaveCount(0);                       // no Saved card
      await expect(page.getByRole('button', { name: 'CLR pressed' })).toHaveCount(0);
      await expect(save(page)).toBeEnabled();                                     // ready to press again
      await expect(page.getByLabel('MAX')).toHaveValue('18.5');                   // what was typed is kept
      const first = script.sent[0];
      // the card is still Due
      await page.getByRole('button', { name: '← Rooms' }).click();
      await expect(card(page, 'Room 5')).not.toHaveClass(DONE);
      await expect(card(page, 'Room 5')).toContainText('Due');
      // when the script works again, the same reading saves and ticks
      script.mode.save = 'ok';
      await openRoom(page, 'Room 5');
      await typeReading(page, '18.5', '12.0');
      await save(page).click();
      await expect(page.locator('.tg-clr')).toContainText('✓ Saved');
      expect(script.sent.length).toBe(2);
      expect(script.sent[1].fields).toEqual(first.fields);
      await page.getByRole('button', { name: 'CLR pressed' }).click();
      await expect(card(page, 'Room 5')).toHaveClass(DONE);
      expect(errors).toEqual([]);
    });
  }

  test('a second press after "could not reach" carries the same request number, so it cannot save twice', async ({ page }) => {
    const { script } = await round(page);
    await openRoom(page, 'Room 5');
    await typeReading(page, '18.5', '12.0');
    script.mode.save = 'offline';
    await save(page).click();
    await expect(page.locator('#screen .msg').last()).toHaveText(NO_REACH);
    script.mode.save = 'ok';
    await save(page).click();
    await expect(page.locator('.tg-clr')).toContainText('✓ Saved');
    expect(script.sent).toHaveLength(2);
    const ids = script.sent.map((b) => b.requestId || b.request_id);
    expect(ids[0], 'the save carries a request number').toBeTruthy();
    expect(ids[1]).toBe(ids[0]);
  });

  test('Room empty (skip): saves with no temperatures, finishes with Done, and the card says Room empty', async ({ page }) => {
    const { script } = await round(page);
    await openRoom(page, 'Room 6');
    await page.getByLabel('Room empty').check();
    await expect(page.getByText('Dogs are recorded in this room.')).toBeVisible();   // it warns: the list has dogs here
    await save(page).click();
    await expect(page.locator('.tg-clr')).toContainText('✓ Saved');
    await expect(page.getByText('Now press CLR on the thermometer.')).toHaveCount(0);
    expect(script.sent[0].fields).toMatchObject({ area_id: 'ar-6', room_empty: 'yes' });
    expect(script.sent[0].fields.max_c).toBeUndefined();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(card(page, 'Room 6')).toContainText('Room empty');
  });

  test('wrong typing is stopped before anything is sent: two decimals, lowest above highest, nothing typed', async ({ page }) => {
    const { script } = await round(page);
    await openRoom(page, 'Room 5');
    await expect(page.getByLabel('MAX')).toBeVisible();
    await save(page).click();
    await expect(page.locator('#screen .msg').last()).toHaveText('Type MAX and MIN, one decimal place.');
    await page.getByLabel('MAX').fill('18.55');
    await expect(page.getByText('One decimal place, e.g. 18.5')).toBeVisible();
    await page.getByLabel('MAX').fill('12.0');
    await page.getByLabel('MIN').fill('18.5');
    await save(page).click();
    await expect(page.locator('.tg-clr')).toHaveCount(0);
    expect(script.sent).toHaveLength(0);
  });

  // One temperature rule (Temps A, 16 Nov 2026; staff/lib/temp-judge.js): below the room limit is outside the limit; above it
  // is a cooling action. Both ask what was done; only the cold one is marked Outside on the card.
  test('below the limit: it asks what was done, will not save without it, and the card says Outside', async ({ page }) => {
    const { script } = await round(page);
    await openRoom(page, 'Room 5');
    await typeReading(page, '15.0', '8.0');
    await expect(page.getByText('Below the limit.')).toBeVisible();
    await save(page).click();
    await expect(page.locator('#screen .msg').last()).toHaveText('Say what was done.');
    expect(script.sent).toHaveLength(0);
    await page.getByLabel('What was done').fill('Sample: heater switched on');
    await save(page).click();
    await expect(page.locator('.tg-clr')).toContainText('✓ Saved');
    expect(script.sent[0].fields).toMatchObject({ min_c: '8.0', mitigation_note: 'Sample: heater switched on' });
    await page.getByRole('button', { name: 'CLR pressed' }).click();
    await expect(card(page, 'Room 5')).toContainText('Outside 8.0–15.0');
  });

  test('over the limit: it asks what cooling was done, will not save without it, and the card is not marked Outside', async ({ page }) => {
    const { script } = await round(page);
    await openRoom(page, 'Room 5');
    await typeReading(page, '28.5', '15.0');
    await expect(page.getByText('Over the limit: what cooling was done?')).toBeVisible();
    await save(page).click();
    await expect(page.locator('#screen .msg').last()).toHaveText('Say what was done.');
    expect(script.sent).toHaveLength(0);
    await page.getByLabel('What was done').fill('Sample: vents opened');
    await save(page).click();
    await expect(page.locator('.tg-clr')).toContainText('✓ Saved');
    expect(script.sent[0].fields).toMatchObject({ max_c: '28.5', mitigation_note: 'Sample: vents opened' });
    await page.getByRole('button', { name: 'CLR pressed' }).click();
    await expect(card(page, 'Room 5')).toContainText('15.0–28.5');
    await expect(card(page, 'Room 5')).not.toContainText('Outside');
  });

  test('Bed spot reading opens and is sent; Read with camera says when the camera cannot be used and opens the boxes', async ({ page }) => {
    const { script, errors } = await round(page);
    await openRoom(page, 'Room 5');
    await page.getByRole('button', { name: 'Read with camera' }).click();
    await expect(page.getByLabel('MAX')).toBeVisible({ timeout: 15000 });   // no camera here: the typing boxes open instead
    await expect(page.locator('#screen .msg').filter({ hasText: /camera|Camera|Type/ }).first()).toBeVisible();
    await page.getByLabel('MAX').fill('18.5');
    await page.getByLabel('MIN').fill('12.0');
    await page.getByText('Bed spot reading (optional)').click();
    await page.getByLabel('Bed spot').fill('16.0');
    await save(page).click();
    await expect(page.locator('.tg-clr')).toContainText('✓ Saved');
    expect(script.sent[0].fields).toMatchObject({ spot_c: '16.0', max_c: '18.5', min_c: '12.0' });
    expect(errors).toEqual([]);
  });
});

test.describe('The Round: the buttons under the list', () => {
  test('Add earlier reading: a past morning lists that day\'s rooms; OK ticks, FAIL does not; today is turned away', async ({ page }) => {
    const { script } = await round(page);
    await page.getByRole('button', { name: EARLIER }).click();
    await expect(page.getByRole('heading', { name: /earlier reading/i })).toBeVisible();
    await page.getByLabel('Day').fill('2026-03-10');
    await page.getByLabel('Day').dispatchEvent('change');
    await expect(page.locator('#screen .msg.bad')).toBeVisible();          // today is turned away: that is the round
    await expect(page.locator('.cards .card')).toHaveCount(0);
    await page.getByLabel('Day').fill('2026-03-08');
    await page.getByLabel('Day').dispatchEvent('change');
    await expect(page.locator('.cards .card .nm').first()).toBeVisible();
    await card(page, 'Room 5').click();
    await expect(page.locator('#screen .sub').filter({ hasText: /Earlier reading/ })).toContainText('Morning');
    await expect(page.getByRole('button', { name: 'Read with camera' })).toHaveCount(0);   // an earlier day is typed, never read by camera
    await page.getByLabel('MAX').fill('18.0');
    await page.getByLabel('MIN').fill('11.5');
    script.mode.save = 'fail';
    await save(page).click();
    await expect(page.locator('#screen .msg').last()).toHaveText(NO_REACH);
    await expect(page.locator('.tg-clr')).toHaveCount(0);
    script.mode.save = 'ok';
    await save(page).click();
    await expect(page.locator('.tg-clr')).toContainText('✓ Saved');
    expect(script.sent[script.sent.length - 1].fields).toMatchObject({ area_id: 'ar-5', period_start: '2026-03-08T00:00:00+00:00', read_method: 'photo' });
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(card(page, 'Room 5')).toHaveClass(DONE);
    await page.getByLabel('Morning or afternoon').selectOption('pm');                     // the other half of the day is its own list
    await expect(card(page, 'Room 5')).not.toHaveClass(DONE);
    await page.getByRole('button', { name: '← Rooms' }).click();
    await expect(page.getByRole('heading', { name: 'Room temperatures' })).toBeVisible();
  });

  test('Year report: pick a room, Open report shows its days, Print asks the browser to print', async ({ page }) => {
    const { errors } = await round(page);
    await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Room temperatures' })).toBeVisible();
    await page.getByRole('button', { name: REPORT }).click();
    const room = page.getByLabel('Room');
    await expect(room.locator('option').first()).toHaveText('Choose the room');
    await room.selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Open report' }).click();
    await expect(page.locator('.tg-tab').first()).toBeVisible();
    await page.getByRole('button', { name: 'Print' }).click();
    expect(await page.evaluate(() => window.__printed)).toBe(1);
    await page.getByRole('button', { name: '← Rooms' }).click();
    await expect(page.getByRole('heading', { name: 'Room temperatures' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Sensor CSV opens with a room picker and a file box, and Rooms goes back', async ({ page }) => {
    const { errors } = await round(page);
    await page.getByRole('button', { name: IMPORT }).click();
    await expect(page.locator('#screen h2')).toBeVisible();
    await expect(page.getByLabel('Room').locator('option')).toHaveText(['Choose the room', 'Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6', 'Field 1']);
    await expect(page.locator('#screen input[type="file"]')).toBeVisible();
    await page.getByRole('button', { name: '← Rooms' }).click();
    await expect(page.getByRole('heading', { name: 'Room temperatures' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a staff code sees the round and Add earlier reading only: no Year report, no Sensor CSV', async ({ page }) => {
    await round(page, { role: 'STAFF' });
    await expect(page.getByRole('button', { name: EARLIER })).toBeVisible();
    await expect(page.getByRole('button', { name: REPORT })).toHaveCount(0);
    await expect(page.getByRole('button', { name: IMPORT })).toHaveCount(0);
  });
});

test.describe('The Round: scan and move', () => {
  const scan = async (page, tag) => { await page.goto('cdhub/staff/#mv/' + tag); };

  test('a room sign opens the room: its dogs, the flap buttons (OK and FAIL), and Temperature for this room', async ({ page }) => {
    const { script, errors } = await round(page);
    await scan(page, 'ROOMAAAB');
    await expect(page.getByRole('heading', { name: 'Room 2', exact: true })).toBeVisible();
    await expect(page.locator('.cards .card .nm')).toHaveText(['Dog A05', 'Dog A06', 'Dog A12']);
    const free = page.getByRole('button', { name: 'Flap free' }), limited = page.getByRole('button', { name: 'Flap limited' });
    await expect(free).toHaveAttribute('aria-pressed', 'true');
    script.mode.save = 'fail';
    await limited.click();
    await expect(page.locator('#screen .msg').first()).toHaveText(NO_REACH);
    await expect(free).toHaveAttribute('aria-pressed', 'true');           // not changed: the save did not land
    script.mode.save = 'ok';
    await limited.click();
    await expect(page.locator('#screen .msg').first()).toContainText('Flap saved as limited.');
    await expect(limited).toHaveAttribute('aria-pressed', 'true');        // the lit button follows the save that landed
    await expect(free).toHaveAttribute('aria-pressed', 'false');
    expect(script.sent[script.sent.length - 1]).toMatchObject({ table: 'area_access', fields: { area_id: 'ar-2', access_type: 'limited' } });
    // Temperature: the round puts the scanned room first; a room still due opens straight at its reading
    await page.getByRole('button', { name: 'Temperature' }).click();
    await expect(page.locator('.cards .card').first()).toContainText('Room 2');
    await expect(page.locator('.cards .card').first()).toContainText('You scanned this');
    await expect(page.locator('.cards .card').first()).toContainText('12.5–18.0');
    await scan(page, 'ROOMAAAF');
    await page.getByRole('button', { name: 'Temperature' }).click();
    await expect(page.locator('#screen h2')).toHaveText('Room 6');
    await expect(page.locator('#screen .sub').first()).toContainText('Morning reading');
    expect(errors).toEqual([]);
  });

  test('a dog card after a room sign moves the dog there: OK says moved, FAIL says not saved', async ({ page }) => {
    // Room 2 has a space here: Dog A12 is taken out of the invented rows before the page reads them
    const { script, errors } = await round(page, { tables: (t) => { t.occupancy = t.occupancy.filter((r) => r.subject_id !== 'sub-a12'); } });
    await scan(page, 'ROOMAAAB');
    await expect(page.getByRole('heading', { name: 'Room 2', exact: true })).toBeVisible();
    await expect(page.locator('#screen .sub').first()).toContainText('2 of 3 now.');
    script.mode.save = 'fail';
    await scan(page, 'DOGAAAAD');                                          // Dog A04, from Room 1
    await expect(page.getByRole('heading', { name: 'Dog A04' })).toBeVisible();
    await expect(page.locator('#screen .msg.bad').first()).toContainText('Dog A04: Not saved:');
    script.mode.save = 'ok';
    await scan(page, 'ROOMAAAB');
    await scan(page, 'DOGAAAAD');
    await expect(page.locator('#screen .msg.good').first()).toContainText('Dog A04: moved.');
    expect(script.sent[script.sent.length - 1]).toMatchObject({ table: 'occupancy', fields: { subject_id: 'sub-a04', area_id: 'ar-2' } });
    await scan(page, 'ROOMAAAB');                                          // the room again, then the same card: it is not moved twice
    await expect(page.locator('.cards .card .nm')).toHaveText(['Dog A04', 'Dog A05', 'Dog A06']);   // the moved dog is in the room's list at once, in name order
    await scan(page, 'DOGAAAAD');
    await expect(page.locator('#screen .msg.good').first()).toHaveText('Already recorded in Room 2.');
    expect(script.sent.filter((b) => b.table === 'occupancy')).toHaveLength(2);   // the failed try and the one that landed
    // Take this dog out of its room: needs a reason, then saves
    await page.getByText('Take this dog out of its room').click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Choose why.')).toBeVisible();
    await page.getByLabel('Why is this dog leaving').selectOption('temporary');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('details .msg')).toHaveClass(/(^|\s)good(\s|$)/);   // a landed save: the green line with the tick, who and when
    await expect(page.locator('details .msg')).toContainText('✓');
    expect(script.sent.filter((b) => b.table === 'occupancy_out')).toHaveLength(1);
    // Finished this room ends the filling and goes Home
    await page.goto('cdhub/staff/#scan');
    await expect(page.getByRole('heading', { name: 'Filling Room 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Finished this room' }).click();
    await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible();
    await page.goto('cdhub/staff/#scan');
    await expect(page.getByRole('heading', { name: 'Scan a room sign' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a move that would put a room over its limit is not saved until a reason is given', async ({ page }) => {
    const { script } = await round(page);
    await scan(page, 'ROOMAAAA');                                          // Room 1: 3 of 3
    await expect(page.locator('#screen .sub').first()).toContainText('3 of 3 now.');
    await scan(page, 'DOGAAAAK');                                          // Dog A10
    await expect(page.getByText('⚠ Over the licence limit')).toBeVisible();
    expect(script.sent).toHaveLength(0);                                   // nothing is saved by the scan alone
    await page.getByRole('button', { name: 'Save with this reason' }).click();
    expect(script.sent).toHaveLength(0);                                   // and nothing without a reason
    await page.locator('#screen input[type="text"], #screen textarea').first().fill('Sample reason: short stay while a room is cleaned');
    await page.getByRole('button', { name: 'Save with this reason' }).click();
    await expect(page.locator('#screen .msg.good').first()).toContainText('Dog A10: moved.');
    expect(script.sent[0]).toMatchObject({ table: 'occupancy', fields: { subject_id: 'sub-a10', area_id: 'ar-1', classification_note: 'Sample reason: short stay while a room is cleaned' } });
  });

  test('a dog card with no room scanned first says to scan a room sign; an unknown card says so', async ({ page }) => {
    await round(page);
    await scan(page, 'DOGAAAAD');
    await expect(page.getByText('Scan a room sign first to move this dog.')).toBeVisible();
    await scan(page, 'ZZZZZZZZ');
    await expect(page.getByText('This QR code is not recognised or has been retired.')).toBeVisible();
  });
});

// Overseer 22 Nov 2026: after a move the screen still showed the old room until a full reload (a long wait).
test.describe('Scan and move: the move shows at once, with no read again', () => {
  const scan = async (page, tag) => { await page.goto('cdhub/staff/#mv/' + tag); };
  const reads = (page) => { const r = []; page.on('request', (q) => { if (q.method() === 'POST') { try { const b = JSON.parse(q.postData() || '{}'); if (String(b.action).indexOf('read') === 0) r.push(b.table || (b.tables || []).join(',') || b.action); } catch (e) { /* not JSON */ } } }); return r; };

  test('a saved move shows the dog in its new room and out of the old one, with no read of the lists @regression @live', async ({ page }) => {
    const { script } = await round(page, { tables: (t) => { t.occupancy = t.occupancy.filter((r) => r.subject_id !== 'sub-a12'); } });
    await scan(page, 'ROOMAAAB');
    await expect(page.getByRole('heading', { name: 'Room 2', exact: true })).toBeVisible();
    const seen = reads(page), occBefore = script.tables.occupancy.length;
    await scan(page, 'DOGAAAAD');                                          // Dog A04, from Room 1
    await expect(page.locator('#screen .msg.good').first()).toContainText('Dog A04: moved.');
    await expect(page.locator('[data-last-room]')).toHaveText('Last recorded in Room 2');
    script.tables.occupancy.length = occBefore;                            // a later read would not have it: the screen must not need one
    await scan(page, 'ROOMAAAA');                                          // Room 1: the dog has gone from it
    await expect(page.getByRole('heading', { name: 'Room 1', exact: true })).toBeVisible();
    await expect(page.locator('.cards .card .nm', { hasText: 'Dog A04' })).toHaveCount(0);
    await scan(page, 'ROOMAAAB');                                          // Room 2: the dog is in its list
    await expect(page.locator('.cards .card .nm', { hasText: 'Dog A04' })).toHaveCount(1);
    expect(seen.filter((x) => /occupancy|subject|area,/.test(x) && x !== 'qr_tag')).toEqual([]);   // the dogs and rooms were not read again
  });

  test('a refused move puts the dog back and says Not saved with the reason', async ({ page }) => {
    const { script } = await round(page, { tables: (t) => { t.occupancy = t.occupancy.filter((r) => r.subject_id !== 'sub-a12'); } });
    await scan(page, 'ROOMAAAB');
    script.mode.save = 'refused';
    await scan(page, 'DOGAAAAD');
    await expect(page.locator('#screen .msg.bad').first()).toHaveText('Dog A04: Not saved: Check the entry.');
    await expect(page.locator('[data-last-room]')).toHaveText('Last recorded in Room 1');
  });

  test('Refresh reads where the dogs are, and only that list, and says as of when', async ({ page }) => {
    await round(page);
    await scan(page, 'ROOMAAAB');
    await expect(page.locator('[data-as-of]')).toHaveText(/^as of \d\d:\d\d$/);
    const seen = reads(page);
    await page.locator('[data-refresh-occupancy]').click();
    await expect(page.getByRole('heading', { name: 'Room 2', exact: true })).toBeVisible();
    await expect.poll(() => seen.length).toBe(1);
    expect(seen).toEqual(['occupancy']);
  });
});
