// Click paths Lisa walks: a medicine ask finishes on the dispense record, and every Round control does the job it names.
// Invented rows only. Nothing here is posted to a live sheet.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

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
const open = async (page, id) => {
  await tabClick(page, `#nav button[data-go="${id}"]`);
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};

const WORK = [
  'id,area,item,status,owner,blocked_on,evidence,note',
  'W001,sample,Sample item waiting on Lisa,BLOCKED,Lisa,a sample answer,,',
  'W010,medicine,Identify the medicine given in February,BLOCKED,Lisa,,,',
].join('\n') + '\n';
const DISPENSE = [
  'id,subject_id,given_on,product,dose_volume,route,ruling_needed,note',
  'dsp-1,sub-test-dog-1,2026-02-03,NOT STATED,1 tablet,Oral,,',
  'dsp-2,sub-not-on-list,2026-03-01,NOT STATED,1 tablet,Oral,,',
].join('\n') + '\n';

test.describe('CD Hub: a medicine ask finishes on the record', () => {
  test('Identify the medicine given in February opens that dog’s February record, and a second click does not return to Outstanding @regression', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-WORK.csv', WORK);
    setFile(guard.world, 'BLD-dispense.csv', DISPENSE);
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('[data-hm="needs"] .hm-row', { hasText: 'Identify the medicine given in February' }).locator('a').first().click();
    await expect(page).toHaveURL(/#\/dogs\/feb$/);
    const answer = page.locator('#medAnswer');
    await expect(answer).toContainText('Medicine in Feb 2026');
    await expect(answer).toContainText('Test Dog One');
    await expect(answer).toContainText('Not named');
    await expect(answer).toContainText('03/02/2026');
    await expect(answer).toContainText('1 tablet');
    await expect(answer).not.toContainText('not on the current list');
    await expect(page.locator('#cnt')).toHaveText('3 of 3');
    const card = page.locator('.dc[data-dog="sub-test-dog-1"]');
    await expect(card.locator('details.meds')).toHaveAttribute('open', '');
    await expect(card).toContainText('Not named');
    await open(page, 'work');
    const more = page.locator('#needsCard [data-needall]');
    if (await more.count()) await more.click();
    const row = page.locator('#needsCard .mrow', { hasText: 'Identify the medicine given in February' });
    await expect(row.locator('button')).toHaveAttribute('data-go', 'dogs/feb');
    await row.getByRole('button', { name: /Show the record/ }).click();
    await expect(page).toHaveURL(/#\/dogs\/feb$/);
    await expect(page.locator('#medAnswer')).toContainText('Test Dog One');
    await expect(page).not.toHaveURL(/#\/work$/);
  });

  test('a February medicine ask with no dispense row is not a button that reopens Outstanding', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-WORK.csv', 'id,area,item,status,owner,blocked_on,evidence,note\nW010,medicine,Identify medicine given in Feb,BLOCKED,Lisa,,,\n');
    setFile(guard.world, 'BLD-dispense.csv', 'id,subject_id,given_on,product,dose_volume,route,ruling_needed,note\n');
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('[data-hm="needs"]')).not.toContainText(/medicine given in Feb/i);
    await open(page, 'work');
    const row = page.locator('#work-W010');
    await expect(row).toContainText('Identify medicine given in Feb');
    await expect(row).toContainText('No medicine recorded in Feb');
    await expect(row.locator('button')).toHaveCount(0);
    await expect(page.locator('#needsCard')).not.toContainText(/medicine given in Feb/i);
  });

  test('Show on an ordinary waiting item stays on Outstanding and moves to that row', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await open(page, 'work');
    const jump = page.locator('#needsCard .mrow', { hasText: 'Sample item waiting on Lisa' }).locator('button');
    await expect(jump).toHaveAttribute('data-jump', 'work-W001');
    await jump.click();
    await expect(page).toHaveURL(/#\/work$/);
    await expect(page.locator('#work-W001')).toBeFocused();
  });
});

test.describe('CD Hub: The round controls', () => {
  test('date, saving, flap, move, temperatures and history each finish or explain @regression', async ({ page, guard }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    setFile(guard.world, 'BLD-area_access.csv', 'id,area_id,access_type\nax-1,area-1,free\n');
    await page.clock.install({ time: new Date('2026-11-11T09:30:00Z') });
    const sent = [];
    await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
      sent.push(JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'ax-new', at: '2026-11-11T09:31:00Z' } }) });
    });
    await page.goto('cdhub/');
    await signIn(page);
    await open(page, 'round');
    expect(errors, errors.join('\n')).toEqual([]);
    await expect(page.locator('h2').first()).toHaveText('The round');
    await expect(page.locator('.card[data-area="area-1"]')).toContainText('Step 1:');
    await expect(page.locator('.card[data-area="area-1"]')).toContainText('here');
    await expect(page.getByRole('link', { name: 'Temperature history' })).toHaveAttribute('href', './history.html');

    await page.locator('#rdate').fill('2026-01-15');
    await page.locator('#rdate').dispatchEvent('change');
    await expect(page.locator('#kept-readings')).toContainText('Test Cabin A');
    const savedMin = page.locator('.tmin[data-area="area-1"][data-slot="am"]');
    await savedMin.fill('11.0');
    await savedMin.blur();
    await expect(page.locator('.tmsg[data-area="area-1"][data-slot="am"]')).toContainText('already saved');

    await page.locator('#rdate').fill('2026-11-11');
    await page.locator('#rdate').dispatchEvent('change');
    const amMin = page.locator('.tmin[data-slot="am"]').first();
    const area = await amMin.getAttribute('data-area');
    const amMsg = page.locator(`.tmsg[data-area="${area}"][data-slot="am"]`);
    await amMin.fill('12.34');
    await amMin.blur();
    await expect(amMsg).toHaveText('1 decimal place only, e.g. 18.5');
    await amMin.fill('18.2');
    await amMin.blur();
    await page.locator(`.tmax[data-area="${area}"][data-slot="am"]`).fill('12.4');
    await page.locator(`.tmax[data-area="${area}"][data-slot="am"]`).blur();
    await expect(amMsg).toContainText('lower than min');
    await expect(amMsg).toContainText('Not saved');

    const pmMin = page.locator(`.tmin[data-area="${area}"][data-slot="pm"]`);
    const pmMax = page.locator(`.tmax[data-area="${area}"][data-slot="pm"]`);
    const pmMsg = page.locator(`.tmsg[data-area="${area}"][data-slot="pm"]`);
    await pmMin.fill('15.0');
    await pmMin.blur();
    await pmMax.fill('16.0');
    await pmMax.blur();
    await expect(pmMsg).toHaveText('the afternoon reading can be saved from 12:00');
    expect(sent).toHaveLength(0);

    const flap = page.locator('.racc[data-area="area-1"]');
    await flap.selectOption('limited');
    await expect(page.locator('.rsave[data-area="area-1"]')).toHaveText('saving off — set it up at the top of this page');
    await expect(flap).toHaveValue('free');

    await page.locator('.rdel[data-sub="sub-test-dog-1"]').click();
    await expect(page.locator('.rsave[data-area="area-1"]')).toContainText('Test Dog One stays in this cabin');
    await expect(page.locator('.card[data-area="area-1"]')).toContainText('Test Dog One');

    await page.evaluate(() => {
      localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/AKfyTEST_only_123/exec');
      localStorage.setItem('cdhub.sink.code', 'test-code-1');
    });
    await page.locator('.racc[data-area="area-1"]').selectOption('limited');
    await expect(page.locator('.rsave[data-area="area-1"]')).toHaveText('saved ✓');
    await expect(page.locator('.racc[data-area="area-1"]')).toHaveValue('limited');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ table: 'area_access', action: 'add', fields: { area_id: 'area-1', access_type: 'limited' } });
    expect(sent[0].code).toBe('test-code-1');

    await page.evaluate(() => {
      for (let i = 0; i < 100; i++) {
        const d = { id: 'sub-x-' + i, name: 'Extra Dog ' + i, classification: 'SLA', sex: 'Female', state: 'active', area_id: '', off: '', treats: [], weights: [], findings: [], dna: [], dob: '2020-01-01' };
        CD.dogs.push(d);
        CD._byId[d.id] = d;
      }
      CD._cnt = null;
      go('round', false);
    });
    await expect(page.locator('[data-unshow="more"]')).toBeVisible();
    await page.locator('[data-unshow="more"]').click();
    await expect(page.locator('[data-unshow="all"]')).toBeVisible();
    await page.locator('[data-unshow="all"]').click();
    await expect(page.locator('[data-unshow="all"]')).toHaveCount(0);
    await expect(page.locator('#main')).toContainText('Extra Dog 99');

    await page.locator('#sinkoff').click();
    await expect(page.locator('#sinkcard')).toContainText('Saving on this device: off');
    await page.locator('#sinkurl').fill('https://example.test/not-a-script');
    await page.locator('#sinkon').click();
    await expect(page.locator('#sinkmsg')).toContainText('not a save script address');
    await page.locator('#sinkurl').fill('https://script.google.com/macros/s/AKfyTEST_only_123/exec');
    await page.locator('#sinkcode').fill('');
    await page.locator('#sinkon').click();
    await expect(page.locator('#sinkmsg')).toContainText('Type your staff code too.');

    await page.route(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export\?/, (route) =>
      route.fulfill({ status: 200, contentType: 'text/csv', body: 'on_date,reading_kind,max_temp,min_temp\n2026-01-15,sample,12.0,4.0\n' }));
    await page.clock.resume();   // the history page waits on timers; a paused clock leaves it on 'Getting temperatures'
    await page.getByRole('link', { name: 'Temperature history' }).click();
    await expect(page).toHaveURL(/history\.html/);
    await expect(page.getByRole('link', { name: 'Back to the round' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to the round' }).click();
    await expect(page).toHaveURL(/cdhub\/(?:index\.html)?#\/round$/);
    await expect(page.locator('h2').first()).toHaveText('The round');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
