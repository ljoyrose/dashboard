// JOB 34b: Money Hub checks that no other spec makes yet (after money*, every-click, every-view-access, house-look,
// tests/phone and job34-money-views). Each describe names the gap it fills. Pretend Google and Drive only; every row
// used here is the existing invented sample data, emptied or changed in the test itself (no new fixture files).
const { test, expect, HUBS, sideScroll, tabWalk } = require('../fixtures/job34/load');

const hashTo = (page, v) => page.evaluate((h) => { location.hash = '#/' + h; }, v);
const signInHeader = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
};
/** Keep only the header line(s) of an invented CSV and say "0 rows held" on its count line. */
const emptyCsv = (world, name) => {
  const f = world.files.find((x) => x.name === name);
  const lines = f.content.split('\n');
  f.content = lines[0].replace(/\d+ rows held/, '0 rows held') + '\n' + lines[1] + '\n';
  f.size = String(f.content.length);
};

test.describe('Money Hub: links and buttons go where their words say', () => {
  test('an entity card in "Money by entity" opens that entity; the Money tab stays selected', async ({ page, guard }) => {
    await HUBS.money.open(page, guard);
    await page.locator('#view a.ent[href="#/e/TESTCO"]').first().click();
    await expect(page).toHaveURL(/#\/e\/TESTCO$/);
    await expect(page.locator('#hereTitle')).toHaveText('TESTCO');
    await expect(page.locator('nav.main a[data-nav="money"]')).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveTitle('TESTCO · Money Hub');
  });

  test('every link in "What needs you now" opens the screen it points at', async ({ page, guard }) => {
    await HUBS.money.open(page, guard);
    const card = page.locator('#view section.card.now', { has: page.locator('h3', { hasText: 'What needs you now' }) });
    const hrefs = await card.locator('ul.items a[href^="#/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length, 'the sample data has links in this list').toBeGreaterThan(0);
    for (const href of [...new Set(hrefs)]) {
      await hashTo(page, 'now');
      await card.locator(`ul.items a[href="${href}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(href.replace(/[/#]/g, (c) => '\\' + c) + '$'));
      const view = href.slice(2).split('/')[0];
      await expect(page.locator('#view')).toHaveAttribute('data-view', view);
      if (view === 'e') await expect(page.locator('#hereTitle')).toHaveText(href.slice(4));
    }
  });

  test('every view sets the browser tab title to "<screen> · Money Hub"', async ({ page, guard }) => {
    await HUBS.money.open(page, guard);
    for (const [v, t] of [['now', 'Now'], ['money', 'Money'], ['dates', 'Dates'], ['todo', 'To-do'], ['todo/closed', 'To-do'], ['register/R001', 'To-do'], ['accountant', 'Accountant'], ['control', 'Control'], ['e/TESTPERS', 'TESTPERS']]) {
      await hashTo(page, v);
      await expect(page, '#/' + v).toHaveTitle(t + ' · Money Hub');
    }
  });

  test('changing screen goes back to the top of the page', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await HUBS.money.open(page, guard);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.locator('nav.main a[data-nav="accountant"]').click();
    await expect(page.locator('#hereTitle')).toHaveText('Accountant');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe('Money Hub: signed out on a deep link', () => {
  test('#/accountant signed out shows only the sign-in card; its own "Sign in with Google" button opens Accountant', async ({ page, guard }) => {
    await page.goto('money/#/accountant');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    const card = page.locator('#view .card', { hasText: 'Sign in to see your money' });
    await expect(card).toBeVisible();
    await expect(page.locator('#view')).not.toContainText('Sample open question');
    await expect(page.locator('#refreshBtn')).toBeHidden();
    await expect(page.locator('#signOutBtn')).toBeHidden();
    await card.locator('button[data-action="signin"]', { hasText: 'Sign in with Google' }).click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(page.locator('#hereTitle')).toHaveText('Accountant');
    await expect(page.locator('#view')).toContainText('Sample open question?');
    await expect(page.locator('#signInBtn')).toBeHidden();
  });
});

test.describe('Money Hub: sign-in that goes wrong, then "Sign in again"', () => {
  test.describe('pop-up blocked', () => {
    test.use({ gisMode: 'popup-blocked' });
    test('says the browser blocked it; "Sign in again" works once the pop-up is allowed', async ({ page }) => {
      await page.goto('money/');
      await signInHeader(page);
      await expect(page.locator('#banner')).toContainText('Sign-in window blocked by the browser.');
      await expect(page.locator('#view')).not.toContainText('£');
      await page.evaluate(() => { window.__GIS_MODE = 'ok'; });
      await page.locator('#banner button[data-action="signin"]', { hasText: 'Sign in again' }).click();
      await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
      await expect(page.locator('#banner')).toBeHidden();
    });
  });

  test.describe('Google answers with an error', () => {
    test.use({ gisMode: 'error' });
    test('says "Sign-in did not complete." and shows no figures', async ({ page }) => {
      await page.goto('money/');
      await signInHeader(page);
      await expect(page.locator('#banner')).toContainText('Sign-in did not complete.');
      await expect(page.locator('#banner button')).toHaveText('Sign in again');
      await expect(page.locator('#readStamp')).toHaveText('Not signed in');
      await expect(page.locator('#view')).not.toContainText('£');
    });
  });

  test('after Drive says the sign-in expired (401), "Sign in again" reads the files and the figures come back', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 401/);
    guard.world.failWith = { status: 401, reason: 'authError', message: 'Invalid Credentials', includeAbout: true };
    await page.goto('money/');
    await signInHeader(page);
    await expect(page.locator('#banner')).toContainText('Sign-in expired');
    guard.world.failWith = null;
    await page.locator('#banner button', { hasText: 'Sign in again' }).click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(page.locator('#banner')).toBeHidden();
    await expect(page.locator('#view')).not.toContainText('Could not read Drive');
    await expect(page.locator('#view a.ent', { hasText: 'TESTCO' }).first()).toBeVisible();
  });

  test('when Google\'s sign-in script never loads, the button says "Sign-in unavailable" and a banner says why', async ({ page }) => {
    test.setTimeout(30_000);
    await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* not loaded */' }));
    await page.goto('money/');
    await expect(page.locator('#signInBtn')).toHaveText('Sign-in unavailable', { timeout: 20_000 });
    await expect(page.locator('#signInBtn')).toBeDisabled();
    await expect(page.locator('#banner')).toContainText('Google sign-in did not load.');
    await expect(page.locator('#banner button')).toHaveCount(0);
  });
});

test.describe('Money Hub: someone else\'s account on every screen', () => {
  test('a deep link to Control: the Lisa-only card on every view, tab counts blank, search finds nothing', async ({ page, guard }) => {
    guard.world.email = 'someone.else@example.test';
    await page.goto('money/#/control');
    await signInHeader(page);
    await expect(page.locator('#view')).toContainText('This page is for Lisa only');
    for (const v of ['now', 'money', 'dates', 'todo', 'accountant', 'control', 'e/TESTCO', 'register/R001']) {
      await hashTo(page, v);
      await expect(page.locator('#view'), '#/' + v).toContainText('This page is for Lisa only');
      await expect(page.locator('#view'), '#/' + v).not.toContainText('Sample');
    }
    for (const id of ['nNow', 'nMoney', 'nDates', 'nTodo', 'nAcct', 'nControl']) await expect(page.locator('#' + id), id).toHaveText('');
    await page.locator('[data-search-open]').click();
    await page.locator('#dashSearchBox').fill('Sample');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-search-group="To-dos"], [data-search-group="Dates"], [data-search-group="Accountant questions"]')).toHaveCount(0);
  });
});

test.describe('Money Hub: empty files say so in plain words', () => {
  test('MON-DATES with no rows: Dates says nothing is waiting, Now says nothing due in 14 days, Dates tab has no count', async ({ page, guard }) => {
    emptyCsv(guard.world, 'MON-DATES.csv');
    await HUBS.money.open(page, guard);
    await expect(page.locator('#view')).toContainText('Nothing due in the next 14 days.');
    await expect(page.locator('#nDates')).toHaveText('');
    await hashTo(page, 'dates');
    await expect(page.locator('#view')).toContainText('No dates waiting. Everything in MON-DATES is done.');
    await expect(page.locator('#view h3', { hasText: 'Overdue' })).toHaveCount(0);
  });

  test('accountant file with no rows: "Nothing waiting on the accountant.", no Answered card, no tab count', async ({ page, guard }) => {
    emptyCsv(guard.world, 'QUESTIONS-FOR-ACCOUNTANT.csv');
    await HUBS.money.open(page, guard);
    await expect(page.locator('#nAcct')).toHaveText('');
    await hashTo(page, 'accountant');
    await expect(page.locator('#view')).toContainText('Nothing waiting on the accountant.');
    await expect(page.locator('#view h3', { hasText: 'Answered' })).toHaveCount(0);
  });

  test('register with no rows: Now says "Nothing waiting on you." and the To-do button says "All 0 to-dos"', async ({ page, guard }) => {
    emptyCsv(guard.world, 'MON-REGISTER.csv');
    await HUBS.money.open(page, guard);
    await expect(page.locator('#view')).toContainText('Nothing waiting on you.');
    await expect(page.locator('#view a.btn', { hasText: /^All 0 to-dos$/ })).toHaveAttribute('href', '#/todo');
    await expect(page.locator('#nTodo')).toHaveText('');
  });
});

test.describe('Money Hub: reads again on its own', () => {
  test('ten minutes after signing in it reads Drive again without a click', async ({ page, guard }) => {
    await page.clock.install();
    await HUBS.money.open(page, guard);
    const before = guard.world.calls.length;
    await page.clock.runFor(10 * 60 * 1000 + 1000);
    await expect.poll(() => guard.world.calls.length).toBeGreaterThan(before);
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  });

  test('after signing out, ten minutes pass and Drive is not asked again', async ({ page, guard }) => {
    await page.clock.install();
    await HUBS.money.open(page, guard);
    await page.locator('#signOutBtn').click();
    const before = guard.world.calls.length;
    await page.clock.runFor(21 * 60 * 1000);
    expect(guard.world.calls.length).toBe(before);
    await expect(page.locator('#readStamp')).toHaveText('Not signed in');
  });
});

test.describe('Money Hub: keyboard only', () => {
  test('To-do sub-tabs are reached with Tab and open with Enter', async ({ page, guard }) => {
    await HUBS.money.open(page, guard);
    await page.locator('nav.main a[data-nav="todo"]').click();
    await expect(page.locator('#hereTitle')).toBeFocused();
    const seen = await tabWalk(page, 12);
    for (const t of ['Yours', 'Waiting on others', 'Watching', 'Closed']) expect(seen, t).toContain(t);
    await page.locator('.subnav a[href="#/todo/closed"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/todo\/closed$/);
    await expect(page.locator('#view')).toContainText('Sample finished task');
  });

  test('an entity card is reached with Tab from Money and opens with Enter', async ({ page, guard }) => {
    await HUBS.money.open(page, guard);
    await page.locator('nav.main a[data-nav="money"]').click();
    await expect(page.locator('#hereTitle')).toBeFocused();
    let found = false;
    for (let i = 0; i < 15 && !found; i++) {
      await page.keyboard.press('Tab');
      found = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('href') === '#/e/TESTCO');
    }
    expect(found, 'TESTCO card reached by Tab').toBe(true);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/e\/TESTCO$/);
    await expect(page.locator('#hereTitle')).toHaveText('TESTCO');
  });

  test('"Sign in with Google" in the page works from the keyboard (focus it, press Enter)', async ({ page }) => {
    await page.goto('money/#/dates');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    const btn = page.locator('#view button[data-action="signin"]');
    await btn.focus();
    await expect(btn).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(page.locator('#hereTitle')).toHaveText('Dates');
  });
});

test.describe('Money Hub phone: the problem screens fit at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('"Could not read Drive" with its Try again button: no sideways scroll, button on screen', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal', includeAbout: true };
    await page.goto('money/');
    await signInHeader(page);
    await expect(page.locator('#view')).toContainText('Could not read Drive');
    expect(await sideScroll(page)).toBe(false);
    const b = await page.locator('#view button', { hasText: 'Try again' }).boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
  });

  test('the Lisa-only card with an ordinary address: no sideways scroll', async ({ page, guard }) => {
    guard.world.email = 'someone.else@example.test';
    await page.goto('money/');
    await signInHeader(page);
    await expect(page.locator('#view')).toContainText('This page is for Lisa only');
    expect(await sideScroll(page), 'Lisa-only card').toBe(false);
  });

  // J34b-F20: the "Signed in as <address>." line on the Lisa-only card has no word wrapping (money/index.html:396,
  // .card .note has no overflow-wrap), so a long Google address pushes the page wider than a 390px phone.
  // DECISION NEEDED: wrap the address (overflow-wrap: anywhere on that note), or accept sideways scroll on this card.
  // OWNER: Lisa (page owner) BY 2026-11-13
  test.fixme('J34b-F20: the Lisa-only card with a long address still fits a 390px phone', async ({ page, guard }) => {
    guard.world.email = 'someone.else.with.a.very.long.sample.address@example.test';
    await page.goto('money/');
    await signInHeader(page);
    await expect(page.locator('#view')).toContainText('This page is for Lisa only');
    expect(await sideScroll(page), 'Lisa-only card').toBe(false);
  });

  test('the "Sign in again" banner: no sideways scroll', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 401/);
    guard.world.failWith = { status: 401, reason: 'authError', message: 'Invalid Credentials', includeAbout: true };
    await page.goto('money/');
    await signInHeader(page);
    await expect(page.locator('#banner button', { hasText: 'Sign in again' })).toBeVisible();
    expect(await sideScroll(page)).toBe(false);
  });
});
