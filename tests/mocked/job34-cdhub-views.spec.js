// JOB 34 (group B): CD Hub buttons, links and states that no other spec proves yet.
// Gap map: kept outside the repo. Every dog, litter and buyer here is invented (Test Dog One, Sample Buyer, @example.test).
const { test, expect, HUBS, IDS, fixture, DRIVE } = require('../fixtures/job34/load');

const tab = async (page, id) => {
  await page.locator(`#nav button[data-go="${id}"]`).click();
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};
const addTable = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-job34-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};

test.describe('CD Hub: Dogs search, Clear filters and the weighings panel', () => {
  test('typing in Search narrows the cards; Clear filters brings every dog back', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'dogs');
    await expect(page.locator('#cnt')).toHaveText('3 of 3');
    await page.locator('#q').fill('pup');
    await expect(page.locator('#cnt')).toHaveText('1 of 3');
    await expect(page.locator('.dc .nm')).toHaveText(['Test Pup One']);
    await page.locator('[data-fpanel="fp-dogs"]').click();
    await page.locator('#fs').selectOption('Male');
    await expect(page.locator('#cnt')).toHaveText('0 of 3');
    await page.locator('#clr').click();
    await expect(page.locator('#q')).toHaveValue('');
    await expect(page.locator('#fs')).toHaveValue('');
    await expect(page.locator('#cnt')).toHaveText('3 of 3');
  });

  test('a dog\'s Weight opens its weighings (newest first, with the change), and close shuts it', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'dogs');
    await page.locator('.dc', { hasText: 'Test Dog One' }).locator('.wtc').first().click();
    const panel = page.locator('#wpanel');
    await expect(panel).toContainText('Test Dog One: weighings');
    await expect(panel.locator('tbody tr')).toHaveCount(2);
    await expect(panel.locator('tbody tr').first()).toContainText('14.6 kg');
    await expect(panel.locator('tbody tr').first()).toContainText('+0.4');
    await expect(panel.locator('tbody tr').last()).toContainText('first');
    await panel.locator('#wclose').click();
    await expect(panel).toBeEmpty();
  });
});

test.describe('CD Hub: Today lists', () => {
  test('a list tile opens its table; flag says saving is off (never pretends to save); close shuts it', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'today');
    const tile = page.locator('#main .tl[data-list]').first();
    await tile.click();
    const panel = page.locator('#tpanel');
    await expect(panel.locator('table')).toBeVisible();
    const flag = panel.locator('.flagb').first();
    await flag.click();
    await expect(flag).toHaveText('saving off');
    await panel.locator('#tclose').click();
    await expect(panel).toBeEmpty();
  });
});

test.describe('CD Hub: Buyers prospects (invented rows)', () => {
  test('Search, the Buyer signal filter and Clear filters work; Email is a mailto link; Sort by kennel name', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-prospect.csv', fixture('cdhub', 'BLD-prospect.csv'));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'buyers');
    const rows = page.locator('#brows tr');
    await expect(page.locator('#bcnt')).toHaveText('2 of 2');
    await expect(rows.filter({ hasText: 'Sample Kennel Alpha' }).locator('a', { hasText: 'Email' })).toHaveAttribute('href', 'mailto:buyer.alpha@example.test');
    await page.locator('#bq').fill('bravo');
    await expect(page.locator('#bcnt')).toHaveText('1 of 2');
    await expect(rows).toHaveCount(1);
    await page.locator('#bq').fill('');
    await page.locator('[data-fpanel="fp-buyers"]').click();
    await page.locator('#bsig').selectOption('MODERATE');
    await expect(page.locator('#bcnt')).toHaveText('1 of 2');
    await expect(page.locator('#ach-buyers .achip')).toHaveText(/Buyer signal: Moderate/);
    await page.locator('#bclr').click();
    await expect(page.locator('#bcnt')).toHaveText('2 of 2');
    await page.locator('#bsort').selectOption('name');
    await expect(rows.first()).toContainText('Sample Kennel Alpha');
  });

  // FIX-REQUEST J34-F20: cdhub/index.html:1509 ranks with (RK[x]||9); RK['VERY STRONG'] is 0, so the strongest lead falls to the bottom.
  // DECISION NEEDED: fix the sort (CD Hub owner) or accept. OWNER: CD Hub owner. BY 2026-11-06
  test.fixme('J34-F20 default Sort "strongest signal" puts a VERY STRONG lead above a MODERATE one', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-prospect.csv', fixture('cdhub', 'BLD-prospect.csv'));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'buyers');
    await expect(page.locator('#bsort')).toHaveValue('');
    await expect(page.locator('#brows tr').first()).toContainText('Sample Kennel Alpha');
  });
});

test.describe('CD Hub: addresses and the browser buttons', () => {
  test('a link straight to #/litters, opened before sign-in, lands on Litters after sign-in', async ({ page }) => {
    await page.goto('cdhub/#/litters');
    await expect(page.locator('#signinbtn')).toBeEnabled();
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go="litters"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#main h2')).toHaveText('Litters');
  });

  test('browser Back and Forward move between sections and put focus on the heading', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'dogs');
    await tab(page, 'vet');
    await page.goBack();
    await expect(page).toHaveURL(/#\/dogs$/);
    await expect(page.locator('#nav button[data-go="dogs"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#main h2')).toBeFocused();
    await page.goForward();
    await expect(page.locator('#nav button[data-go="vet"]')).toHaveAttribute('aria-current', 'page');
  });

  test('an unknown section address falls back to the Map', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await page.goto('cdhub/#/nonsense');
    await expect(page.locator('#nav button[data-go="map"]')).toHaveAttribute('aria-current', 'page');
  });

  test('The round: picking another date redraws the round for that date', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    await page.locator('#rdate').fill('2026-01-15');
    await page.locator('#rdate').dispatchEvent('change');
    await expect(page.locator('#rdate')).toHaveValue('2026-01-15');
    await expect(page.locator('.card[data-area]').first()).toContainText('Step 1:');
  });
});

test.describe('CD Hub: entry boxes on The round and Areas (saving is off, so nothing may claim it saved)', () => {
  test('a temperature with 3 decimals is refused ("2 dp only"); a 2-decimal one says saving off', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    const box = page.locator('.tmin').first();
    const area = await box.getAttribute('data-area'), slot = await box.getAttribute('data-slot');
    const msg = page.locator(`.tmsg[data-area="${area}"][data-slot="${slot}"]`);
    await box.fill('12.345');
    await box.blur();
    await expect(msg).toHaveText('2 dp only');
    await expect(box).toHaveClass(/\bbad\b/);
    await box.fill('12.50');
    await box.blur();
    await expect(msg).toHaveText('saving off');
    await expect(box).not.toHaveClass(/\bbad\b/);
  });

  test('changing how a cabin is run (The round) or an area\'s access (Areas) says saving off', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    const racc = page.locator('.racc').first();
    const ra = await racc.getAttribute('data-area');
    const rv = await racc.locator('option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
    await racc.selectOption(rv[rv.length - 1]);
    await expect(page.locator(`.rsave[data-area="${ra}"]`)).toHaveText('saving off');
    await tab(page, 'areas');
    const aacc = page.locator('.aacc').first();
    const aa = await aacc.getAttribute('data-area');
    const av = await aacc.locator('option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
    await aacc.selectOption(av[av.length - 1]);
    await expect(page.locator(`.asave[data-area="${aa}"]`)).toHaveText('saving off');
  });
});

test.describe('CD Hub: slow and failed reads', () => {
  test('while Drive is slow the pill says it is reading, and no section shows yet; then it goes live', async ({ page }) => {
    await page.goto('cdhub/');
    await expect(page.locator('#signinbtn')).toBeEnabled();
    let held = false; // hold only the first Drive call (the folder listing), so the test stays quick
    await page.route(DRIVE, async (route) => { if (!held) { held = true; await new Promise((r) => setTimeout(r, 2500)); } return route.fallback(); });
    await page.locator('#signinbtn').click();
    await expect(page.locator('#livepill')).toHaveText('…');
    await expect(page.locator('#nav button[data-go]')).toHaveCount(0);
    await expect(page.locator('#livepill')).toContainText('live');
    await expect(page.locator('#nav button[data-go]')).toHaveCount(10);
  });

  test('after a failed read, Try again reads the folder again and the tables load', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.goto('cdhub/');
    await expect(page.locator('#signinbtn')).toBeEnabled();
    await page.locator('#signinbtn').click();
    await expect(page.locator('#main')).toContainText('The folder could not be read');
    guard.world.failWith = null;
    await page.locator('#main button[data-reload]').click();
    await expect(page.locator('#livepill')).toContainText('live');
    await expect(page.locator('#nav button[data-go]')).toHaveCount(10);
  });
});

test.describe('CD Hub: phone top bar Look menu (it replaced the More menu, Lisa\'s pick A)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('Look opens its menu; Escape and a tap outside both close it', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await expect(page.locator('#moreBtn, #moreMenu')).toHaveCount(0);
    const btn = page.locator('#houseLookBtn'), menu = page.locator('#houseLook');
    await btn.click();
    await expect(menu).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await btn.click();
    await expect(menu).toBeVisible();
    await page.mouse.click(195, 760); // the lower page, well away from the header menu
    await expect(menu).toBeHidden();
  });
});
