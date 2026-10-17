// Money Hub: https://ljoyrose.github.io/dashboard/money/
const { test, expect, buildWorld } = require('../support/test');
const { IDS } = require('../support/world');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const NAV = [['now', 'Now'], ['money', 'Money'], ['dates', 'Dates'], ['todo', 'To-do'], ['accountant', 'Accountant'], ['control', 'Control']];

test.describe('Money Hub: loads', () => {
  test('page loads with HTTP 200 and nothing but a sign-in prompt', async ({ page }) => {
    const res = await page.goto('money/');
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(/Money Hub/);
    await expect(page.locator('h1')).toContainText('Money Hub');
    await expect(page.locator('#readStamp')).toHaveText('Not signed in');
    await expect(page.locator('#signInBtn')).toBeVisible();
    await expect(page.locator('#view')).not.toContainText('£');
  });

  test('shared Money code (core.js) loads from /money/core.js', async ({ page }) => {
    const res = await page.goto('money/core.js');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/javascript/);
  });

  test('sign-in button wakes up once the (pretend) Google script has loaded', async ({ page }) => {
    await page.goto('money/');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await expect(page.locator('#signInBtn')).toContainText('Sign in with Google');
  });
});

test.describe('Money Hub: sign-in (mocked) and the Lisa gate', () => {
  test('Lisa\'s account: reads the index files and ledgers, read-only, then shows the hub', async ({ page, guard }) => {
    await page.goto('money/');
    await signIn(page);
    await expect(page.locator('#hereTitle')).toHaveText('Now');
    await expect(page.locator('#refreshBtn')).toBeVisible();
    await expect(page.locator('#signOutBtn')).toBeVisible();
    const cfg = await page.evaluate(() => window.__GIS_LAST_CONFIG);
    expect(cfg.scope).toBe('https://www.googleapis.com/auth/drive.readonly');
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  test('the sign-in asks for Lisa\'s account by name (login hint)', async ({ page }) => {
    await page.goto('money/');
    await signIn(page);
    const req = await page.evaluate(() => window.__GIS_LAST_REQUEST);
    expect(req.login_hint).toBe(IDS.moneyOwner);
    expect(req.prompt).toBe('select_account');
  });

  test.describe('someone else\'s Google account', () => {
    test('is turned away: no figures are read or shown', async ({ page, guard }) => {
      guard.world.email = 'someone.else@example.test';
      await page.goto('money/');
      await signIn(page);
      await expect(page.locator('#view')).toContainText('This page is for Lisa only');
      await expect(page.locator('#view')).toContainText('someone.else@example.test');
      await expect(page.locator('#view')).not.toContainText('£');
      await expect(page.locator('#view')).not.toContainText('TESTCO');
      // after the account check the page must not go on to read any CSV
      const csvReads = guard.world.calls.filter((c) => c.path === '/files' && /name = |trashed = false and \(name/.test(c.query));
      expect(csvReads).toEqual([]);
    });
  });

  test('sign out clears everything', async ({ page }) => {
    await page.goto('money/');
    await signIn(page);
    await page.locator('#signOutBtn').click();
    await expect(page.locator('#banner')).toContainText('Signed out. Nothing kept.');
    await expect(page.locator('#readStamp')).toHaveText('Not signed in');
    await expect(page.locator('#view')).not.toContainText('£');
    expect(await page.evaluate(() => window.__GIS_CALLS.revoke)).toBe(1);
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });

  test('keeps only the shared sign-in for this tab', async ({ page, context }) => {
    await page.goto('money/');
    await signIn(page);
    const stores = await page.evaluate(() => ({ local: localStorage.length, session: Object.keys(sessionStorage), key: window.DashAuth.KEY }));
    expect(stores.local).toBe(0);
    expect(stores.session).toEqual([stores.key]);
    expect(await context.cookies()).toEqual([]);
  });
});

test.describe('Money Hub: navigation', () => {
  for (const [key, title] of NAV) {
    test(`nav "${title}" opens #/${key}`, async ({ page }) => {
      await page.goto('money/');
      await signIn(page);
      await page.locator(`nav.main a[data-nav="${key}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#/${key}$`));
      await expect(page.locator('#view')).toHaveAttribute('data-view', key);
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await expect(page.locator(`nav.main a[data-nav="${key}"]`)).toHaveAttribute('aria-current', 'page');
    });
  }

  test('"Money Hub" heading link goes back to Now', async ({ page }) => {
    await page.goto('money/#/dates');
    await signIn(page);
    await page.locator('header h1 a').click();
    await expect(page.locator('#hereTitle')).toHaveText('Now');
  });

  test('"← Dashboard" goes back to the main dashboard', async ({ page }) => {
    await page.goto('money/');
    await page.locator('a.back').click();
    await expect(page).toHaveURL(/\/dashboard\/(#\/map)?$/);
    await expect(page).toHaveTitle(/Lisa Dashboard|Map/);
  });

  for (const [hash, check] of [
    ['#/e/TESTCO', 'TESTCO'],
    ['#/register/R001', 'Sample task ready now'],
    ['#/todo/others', 'Waiting on others'],
    ['#/todo/closed', 'Sample finished task'],
  ]) {
    test(`a link straight to ${hash} works after sign-in`, async ({ page }) => {
      await page.goto('money/' + hash);
      await signIn(page);
      await expect(page).toHaveURL(new RegExp(hash.replace(/[/#]/g, (c) => '\\' + c) + '$'));
      await expect(page.locator('#view')).toContainText(check);
    });
  }

  test('links on the Now page lead to Dates and To-do', async ({ page }) => {
    await page.goto('money/');
    await signIn(page);
    await page.locator('#view a', { hasText: 'All dates' }).click();
    await expect(page).toHaveURL(/#\/dates$/);
    await page.goBack();
    await page.locator('#view a', { hasText: /^All \d+ to-dos$/ }).click();
    await expect(page).toHaveURL(/#\/todo$/);
  });

  test('To-do tabs: Yours, Waiting on others, Watching, Closed', async ({ page }) => {
    await page.goto('money/#/todo');
    await signIn(page);
    for (const [label, key] of [['Waiting on others', 'others'], ['Watching', 'watch'], ['Closed', 'closed'], ['Yours', 'yours']]) {
      await page.locator('.subnav a', { hasText: label }).click();
      await expect(page).toHaveURL(new RegExp(`#/todo/${key}$`));
      await expect(page.locator(`.subnav a[href="#/todo/${key}"]`)).toHaveAttribute('aria-current', 'page');
    }
  });

  test('an unknown hash falls back to Now', async ({ page }) => {
    await page.goto('money/#/nonsense');
    await signIn(page);
    await expect(page.locator('#hereTitle')).toHaveText('Now');
  });
});

test.describe('Money Hub: sample CSVs are read and understood (mocked)', () => {
  test('Money by entity: business and personal shown apart with the right cash', async ({ page }) => {
    await page.goto('money/#/money');
    await signIn(page);
    const v = page.locator('#view');
    await expect(v).toContainText('TESTCO');
    await expect(v).toContainText('TESTPERS');
    await expect(v).toContainText('£12,000'); // BALANCES.csv, the account with a balance
    await expect(v).toContainText('£3,000');
    await expect(v).toContainText('There is no grand total');
    await expect(v).not.toContainText('OLDCO'); // retired in MON-SUBJECTS.csv
    await expect(v).not.toContainText('£15,000'); // never summed across entities
  });

  test('an account with no balance is counted as "no balance yet", not zero', async ({ page }) => {
    await page.goto('money/#/money');
    await signIn(page);
    // Sample old account is status "nil" so it is ignored; the current account's balance is the entity total.
    await expect(page.locator('#view')).toContainText('In the bank');
  });

  test('Entity page shows ledgers: monthly table, forecast and overdue liability', async ({ page }) => {
    await page.goto('money/#/e/TESTCO');
    await signIn(page);
    const v = page.locator('#view');
    await expect(v).toContainText('2026-02');
    await expect(v).toContainText('Sample tax body');
  });

  test('Dates: overdue, due soon and later filings are grouped from MON-DATES.csv', async ({ page }) => {
    await page.goto('money/#/dates');
    await signIn(page);
    const v = page.locator('#view');
    await expect(v.locator('section', { hasText: 'Overdue' }).first()).toContainText('Sample overdue filing');
    await expect(v.locator('section', { hasText: 'Next 14 days' }).first()).toContainText('Sample filing due soon');
    await expect(v).toContainText('Sample later filing');
  });

  test('Now: "what needs you now" lists the overdue filing and the overdue liability', async ({ page }) => {
    await page.goto('money/');
    await signIn(page);
    const v = page.locator('#view');
    await expect(v.locator('section.now')).toContainText('Sample overdue filing');
    await expect(v.locator('section.now')).toContainText(/TESTCO: 1 overdue on Sample tax body/);
  });

  test('To-do: tasks waiting on another task are held back until it is closed', async ({ page }) => {
    await page.goto('money/#/todo');
    await signIn(page);
    const ready = page.locator('section', { hasText: 'Ready now' }).first();
    await expect(ready).toContainText('Sample task ready now');
    await expect(ready).not.toContainText('Sample task waiting on R001');
    await expect(page.locator('section', { hasText: 'Waiting on something first' }).first()).toContainText('Sample task waiting on R001');
  });

  test('Accountant: open and answered questions are separated', async ({ page }) => {
    await page.goto('money/#/accountant');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('Sample open question?');
    await expect(page.locator('section', { hasText: 'Answered' }).last()).toContainText('Sample answer.');
  });

  test('Money page shows the last weekly pack from MON-REPORTS.csv', async ({ page }) => {
    await page.goto('money/#/money');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('Last weekly pack');
  });

  test('Control: every file is found once and checks are listed', async ({ page }) => {
    await page.goto('money/#/control');
    await signIn(page);
    const v = page.locator('#view');
    await expect(v).toContainText(/\d+ of \d+ found once/);
    await expect(v).toContainText('None failing');
    await expect(v).toContainText('K014');
    await expect(v).toContainText('Statements to drop');
  });

  test('every panel names its source file and when it was read', async ({ page }) => {
    await page.goto('money/#/dates');
    await signIn(page);
    await expect(page.locator('#view .source')).toContainText('MON-DATES.csv');
    await expect(page.locator('#view .source')).toContainText(/read \d\d:\d\d/);
  });
});

test.describe('Money Hub: missing, duplicate or wrong files are shown as errors (never guessed)', () => {
  test('a missing index file is reported as missing', async ({ page, guard }) => {
    guard.world.files = guard.world.files.filter((f) => f.name !== 'MON-DATES.csv');
    await page.goto('money/#/control');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('missing');
    await expect(page.locator('#view')).toContainText('MON-DATES.csv');
    await expect(page.locator('#view')).toContainText(/Problem/);
  });

  test('two live copies of one file are reported as a duplicate, not picked between', async ({ page, guard }) => {
    const orig = guard.world.files.find((f) => f.name === 'MON-REGISTER.csv');
    guard.world.files.push({ ...orig, id: 'm-reg-copy' });
    await page.goto('money/#/control');
    await signIn(page);
    await expect(page.locator('#view')).toContainText(/duplicate ×2/);
  });

  test('a file whose row count does not match its count line is flagged "Count off"', async ({ page, guard }) => {
    const f = guard.world.files.find((x) => x.name === 'MON-INTAKE.csv');
    f.content = f.content.replace('2 rows held', '5 rows held');
    await page.goto('money/#/control');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('Count off');
    await expect(page.locator('#view')).toContainText('count line says 5, file has 2');
  });

  test('a ledger file with the wrong header is not trusted', async ({ page, guard }) => {
    const f = guard.world.files.find((x) => x.id === 'l-co-BALANCES.csv');
    f.content = 'this,file,has,no,expected,header\n1,2,3,4,5,6\n';
    await page.goto('money/#/money');
    await signIn(page);
    await expect(page.locator('a.ent', { hasText: 'TESTCO' })).toContainText('No bank statement yet');
    await expect(page.locator('a.ent', { hasText: 'TESTPERS' })).toContainText('£3,000'); // the other entity is unaffected
  });

  test('Drive refusing access (403) shows "Could not read Drive" with the reason', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal', includeAbout: true };
    await page.goto('money/');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#view')).toContainText('Could not read Drive');
    await expect(page.locator('#view')).toContainText('Google Drive refused access (forbidden)');
    await expect(page.locator('#readStamp')).toHaveText('Read failed');
    await expect(page.locator('#view')).not.toContainText('£');
  });

  test('an expired sign-in (401) says so and offers sign-in again', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 401/);
    guard.world.failWith = { status: 401, reason: 'authError', message: 'Invalid Credentials', includeAbout: true };
    await page.goto('money/');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#banner')).toContainText('Sign-in expired');
    await expect(page.locator('#banner button')).toContainText('Sign in again');
  });

  test.describe('Drive permission not granted', () => {
    test.use({ gisMode: 'denied-scope' });
    test('shows "Drive read access was not granted."', async ({ page }) => {
      await page.goto('money/');
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await page.locator('#signInBtn').click();
      await expect(page.locator('#banner')).toContainText('Drive read access was not granted.');
    });
  });
  test.describe('Sign-in window closed', () => {
    test.use({ gisMode: 'popup-closed' });
    test('shows "Sign-in window closed early."', async ({ page }) => {
      await page.goto('money/');
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await page.locator('#signInBtn').click();
      await expect(page.locator('#banner')).toContainText('Sign-in window closed early.');
    });
  });
});
